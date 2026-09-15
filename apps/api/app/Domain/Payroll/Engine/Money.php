<?php

namespace App\Domain\Payroll\Engine;

/**
 * Decimal-safe money calculations using string-based arithmetic.
 *
 * NEVER use PHP float for authoritative monetary calculations.
 * This class uses bcmath functions with string operands to ensure
 * financial precision and avoid floating-point rounding errors.
 *
 * All monetary values are represented as strings with 2 decimal places.
 */
final class Money
{
    /**
     * Scale for monetary calculations (2 decimal places for currency).
     */
    private const int SCALE = 2;

    /**
     * Round a monetary value to 2 decimal places.
     *
     * @param  string|float|int  $value  The value to round
     * @return string The rounded value as a decimal string
     */
    public static function round2(string|float|int $value): string
    {
        return bcadd((string) $value, '0', self::SCALE);
    }

    /**
     * Sum an array of monetary values.
     *
     * @param  array<string|float|int>  $values  Array of monetary values
     * @return string The sum as a decimal string
     */
    public static function sum(array $values): string
    {
        $total = array_reduce(
            $values,
            fn ($carry, $value) => bcadd((string) ($carry ?? '0'), (string) $value, self::SCALE),
            '0'
        );

        return $total;
    }

    /**
     * Multiply two monetary values.
     *
     * @param  string|float|int  $left  First operand
     * @param  string|float|int  $right  Second operand
     * @return string The product as a decimal string
     */
    public static function mul(string|float|int $left, string|float|int $right): string
    {
        return bcmul((string) $left, (string) $right, self::SCALE);
    }

    /**
     * Add two monetary values.
     *
     * @param  string|float|int  $left  First operand
     * @param  string|float|int  $right  Second operand
     * @return string The sum as a decimal string
     */
    public static function add(string|float|int $left, string|float|int $right): string
    {
        return bcadd((string) $left, (string) $right, self::SCALE);
    }

    /**
     * Subtract two monetary values.
     *
     * @param  string|float|int  $left  First operand
     * @param  string|float|int  $right  Second operand
     * @return string The difference as a decimal string
     */
    public static function sub(string|float|int $left, string|float|int $right): string
    {
        return bcsub((string) $left, (string) $right, self::SCALE);
    }

    /**
     * Divide two monetary values.
     *
     * @param  string|float|int  $left  Dividend
     * @param  string|float|int  $right  Divisor
     * @return string The quotient as a decimal string
     */
    public static function div(string|float|int $left, string|float|int $right): string
    {
        return bcdiv((string) $left, (string) $right, self::SCALE);
    }

    /**
     * Compare two monetary values.
     *
     * @param  string|float|int  $left  First value
     * @param  string|float|int  $right  Second value
     * @return int -1 if left < right, 0 if equal, 1 if left > right
     */
    public static function cmp(string|float|int $left, string|float|int $right): int
    {
        return bccomp((string) $left, (string) $right, self::SCALE);
    }

    /**
     * Check if a monetary value is greater than zero.
     *
     * @param  string|float|int  $value  The value to check
     * @return bool True if value > 0
     */
    public static function isPositive(string|float|int $value): bool
    {
        return self::cmp($value, '0') > 0;
    }

    /**
     * Check if a monetary value is zero.
     *
     * @param  string|float|int  $value  The value to check
     * @return bool True if value == 0
     */
    public static function isZero(string|float|int $value): bool
    {
        return self::cmp($value, '0') === 0;
    }

    /**
     * Convert a value to a decimal string, ensuring it has exactly 2 decimal places.
     *
     * @param  string|float|int  $value  The value to format
     * @return string The formatted decimal string
     */
    public static function toDecimal(string|float|int $value): string
    {
        $result = self::round2($value);

        // Ensure exactly 2 decimal places
        if (str_contains($result, '.')) {
            $parts = explode('.', $result);
            $decimal = $parts[1] ?? '00';
            $decimal = str_pad($decimal, 2, '0');
            $result = $parts[0].'.'.substr($decimal, 0, 2);
        } else {
            $result .= '.00';
        }

        return $result;
    }

    /**
     * Create a stable JSON representation for hashing.
     *
     * This method ensures consistent JSON serialization for use in
     * idempotency hashes, regardless of the order of array keys
     * or the type of numeric values.
     *
     * @param  mixed  $value  The value to serialize
     * @return string Stable JSON string
     */
    public static function stableJson(mixed $value): string
    {
        if (is_array($value)) {
            $isList = array_is_list($value);

            if (! $isList) {
                ksort($value);
            }

            $items = array_map(function ($key, $value) use ($isList) {
                $encodedKey = $isList ? null : json_encode((string) $key, JSON_THROW_ON_ERROR);

                return $isList
                    ? self::stableJson($value)
                    : $encodedKey.':'.self::stableJson($value);
            }, array_keys($value), $value);

            return $isList ? '['.implode(',', $items).']' : '{'.implode(',', $items).'}';
        }

        if (is_string($value)) {
            return json_encode($value, JSON_THROW_ON_ERROR);
        }

        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }

        if (is_null($value)) {
            return 'null';
        }

        if (is_int($value) || is_float($value)) {
            // Convert numeric values to decimal strings for consistent hashing
            return json_encode(self::toDecimal($value), JSON_THROW_ON_ERROR);
        }

        return json_encode($value, JSON_THROW_ON_ERROR);
    }

    /**
     * Convert a float value to a decimal string.
     *
     * This is a helper for transitioning from float-based code.
     * In new code, avoid using floats entirely.
     *
     * @param  float  $value  The float value
     * @return string The decimal string representation
     */
    public static function fromFloat(float $value): string
    {
        return self::toDecimal($value);
    }

    /**
     * Convert a value to a float for compatibility with existing code.
     *
     * WARNING: This should only be used for display purposes or
     * when interfacing with code that requires floats. NEVER use
     * the returned float for calculations.
     *
     * @param  string|float|int  $value  The value to convert
     * @return float The float representation (for display only)
     */
    public static function toFloat(string|float|int $value): float
    {
        return (float) $value;
    }
}
