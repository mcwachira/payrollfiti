<?php

namespace Database\Factories;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

class SubscriptionFactory extends Factory
{
    protected $model = Subscription::class;

    public function definition(): array
    {

        $startsAt = fake()->dateTimeBetween('-6 months', 'now');
        return [
            'tenant_id' => Tenant::factory(),
            'plan_id' => Plan::factory(),
            'status' => 'active',

            'starts_at' => $startsAt,
            'ends_at' => fake()->dateTimeBetween($startsAt, '+1 year'),
            'trial_ends_at' => null,
            'cancelled_at' => null,

            'provider' => fake()->optional()->randomElement([
                'stripe',
                'paystack',
                 'flutterwave',
                'pesapal',
                'mpesa',
            ]),

            'provider_subscription_id' => fake()->optional()->bothify(
                'sub_################'
            ),

            'metadata' => [
                'source' => fake()->randomElement([
                    'web',
                    'admin',
                    'api',
                ]),
            ],
        ];
    }

    public function active(): static
    {
        return $this->state([
            'status' => 'active',
            'trial_ends_at' => null,
            'cancelled_at' => null,
        ]);
    }

    public function trialing(): static
    {
        $startsAt = now();

        return $this->state([
            'status' => 'trialing',
            'starts_at' => $startsAt,
            'trial_ends_at' => $startsAt->copy()->addDays(14),
            'ends_at' => null,
            'cancelled_at' => null,
        ]);
    }

    public function cancelled(): static
    {
        $startsAt = fake()->dateTimeBetween('-6 months', '-1 month');
        $cancelledAt = fake()->dateTimeBetween($startsAt, 'now');

        return $this->state([
            'status' => 'cancelled',
            'starts_at' => $startsAt,
            'cancelled_at' => $cancelledAt,
            'ends_at' => null,
            'trial_ends_at' => null,
        ]);
    }

    public function expired(): static
    {
        $startsAt = fake()->dateTimeBetween('-1 year', '-6 months');

        return $this->state([
            'status' => 'expired',
            'starts_at' => $startsAt,
            'ends_at' => fake()->dateTimeBetween($startsAt, '-1 day'),
            'trial_ends_at' => null,
            'cancelled_at' => null,
        ]);
    }
}
