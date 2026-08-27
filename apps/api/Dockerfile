# apps/api/Dockerfile — Laravel API (pure backend, port 8000)

FROM php:8.3-cli-alpine

WORKDIR /var/www

# curl: docker-compose healthcheck
# postgresql-dev / libzip-dev / oniguruma-dev: build deps for the PHP
# extensions Laravel needs (pdo_pgsql, zip, mbstring)
# git / unzip: required by Composer
RUN apk add --no-cache \
    curl \
    git \
    unzip \
    postgresql-dev \
    libzip-dev \
    oniguruma-dev \
    $PHPIZE_DEPS \
    && docker-php-ext-install pdo pdo_pgsql zip mbstring bcmath \
    && apk del $PHPIZE_DEPS

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Dependencies first — layer cache only busts on composer.* changes
COPY apps/api/composer.json apps/api/composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist

COPY apps/api/ .

RUN composer dump-autoload --optimize \
    && php artisan config:clear

# Match PAYSLIP_STORAGE_DIR / DOCUMENT_STORAGE_DIR from docker-compose.yml
RUN mkdir -p storage/payslips storage/documents \
    storage/framework/sessions storage/framework/views storage/framework/cache \
    storage/logs bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --retries=10 --start-period=15s \
    CMD curl -f http://localhost:8000/up || exit 1

# artisan serve is fine here since nginx sits in front as the reverse
# proxy — but it's still single-threaded PHP, not built for heavy
# concurrent production load. Swap to php-fpm (or Octane) behind nginx
# if/when traffic needs it.
CMD php artisan migrate --force && \
    php artisan serve --host=0.0.0.0 --port=8000
