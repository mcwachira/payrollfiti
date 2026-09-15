<?php

namespace App\Domain\Payments\Exceptions;

class WebhookVerificationException extends PaymentException
{
    public static function for(string $message): self
    {
        return new self($message);
    }
}
