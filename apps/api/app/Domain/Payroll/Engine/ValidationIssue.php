<?php

namespace App\Domain\Payroll\Engine;

final readonly class ValidationIssue
{
    public function __construct(
        public string $field,
        public string $message,
    ) {}
}
