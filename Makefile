# Makefile — shortcuts for docker compose commands
# Run `make help` to see this list from the terminal.

.DEFAULT_GOAL := help
.PHONY: help up down restart build rebuild ps logs logs-api logs-web logs-db logs-redis \
        shell-api shell-web shell-db \
        artisan migrate migrate-fresh seed key-generate test \
        pnpm composer-install fresh clean prune

## ---- Core lifecycle ----

up: ## Start all services in the background
	docker compose up -d

down: ## Stop and remove all containers
	docker compose down

restart: ## Restart all services
	docker compose restart

build: ## Build images without cache invalidation shortcuts
	docker compose build

rebuild: ## Rebuild images from scratch (no cache) and restart
	docker compose build --no-cache
	docker compose up -d

ps: ## Show running containers and their status
	docker compose ps

## ---- Logs ----

logs: ## Tail logs for all services
	docker compose logs -f

logs-api: ## Tail logs for the api service only
	docker compose logs -f api

logs-web: ## Tail logs for the web service only
	docker compose logs -f web

logs-db: ## Tail logs for the db service only
	docker compose logs -f db

logs-redis: ## Tail logs for the redis service only
	docker compose logs -f redis

## ---- Shells ----

shell-api: ## Open a shell inside the running api container
	docker compose exec api sh

shell-web: ## Open a shell inside the running web container
	docker compose exec web sh

shell-db: ## Open a psql shell inside the running db container
	docker compose exec db psql -U payrollfiti -d payrollfiti

## ---- Laravel ----

artisan: ## Run an artisan command, e.g. `make artisan cmd="make:model Payslip"`
	docker compose exec api php artisan $(cmd)

migrate: ## Run pending migrations
	docker compose exec api php artisan migrate

migrate-fresh: ## Drop all tables and re-run migrations (destroys data)
	docker compose exec api php artisan migrate:fresh

seed: ## Run database seeders
	docker compose exec api php artisan db:seed

key-generate: ## Generate a fresh APP_KEY
	docker compose exec api php artisan key:generate

test: ## Run the Laravel test suite
	docker compose exec api php artisan test

## ---- Dependencies ----

pnpm: ## Run a pnpm command in web, e.g. `make pnpm cmd="add axios"`
	docker compose exec web pnpm $(cmd)

composer-install: ## Reinstall composer dependencies inside the api container
	docker compose exec api composer install

## ---- Cleanup ----

fresh: ## Full reset: down, rebuild, up, migrate, seed
	docker compose down
	docker compose build --no-cache
	docker compose up -d
	docker compose exec api php artisan migrate:fresh --seed

clean: ## Stop everything and remove volumes (destroys db data)
	docker compose down -v

prune: ## Remove dangling images/containers/networks system-wide (not just this project)
	docker system prune -f

## ---- Help ----

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
