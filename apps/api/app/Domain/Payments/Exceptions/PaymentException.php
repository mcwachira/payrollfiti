<?php

namespace App\Domain\Payments\Exceptions;

use RuntimeException;
use Throwable;

class PaymentException extends RuntimeException
{
    public function __construct(string $message, private readonly bool $retryable = false, ?Throwable $previous = null)
    {
        parent::__construct($message, 0, $previous);
    }

    public function isRetryable(): bool
    {
        return $this->retryable;
    }

    public static function webhookVerification(string $message): self
    {
        return new self($message);
    }
}
