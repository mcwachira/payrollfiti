<?php

use App\Http\Controllers\AccountSessionController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\TwoFactorAuthenticationController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::middleware('web')->prefix('api')->group(function () {
    Route::get('/sanctum/csrf-cookie', function (Request $request) {
        return response()->json([
            'status' => 'ok',
            'token' => $request->session()->token(),
        ]);
    });

    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);

    Route::post('/signup', [AuthController::class, 'signup']);
    Route::post('/accept-invite', [AuthController::class, 'acceptInvite']);
    Route::post('/refresh', [AuthController::class, 'refresh']);

    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
    Route::get('/me', [AuthController::class, 'me'])->middleware('auth:sanctum');

    Route::middleware(['auth:sanctum', 'tenant.context'])->prefix('account')->group(function () {
        Route::get('/sessions', [AccountSessionController::class, 'index']);
        Route::delete('/sessions/others', [AccountSessionController::class, 'destroyOthers']);
        Route::delete('/sessions/{id}', [AccountSessionController::class, 'destroy']);
    });

    Route::prefix('account/2fa')->middleware('auth:sanctum')->controller(TwoFactorAuthenticationController::class)->group(function () {
        Route::get('status', 'status');
        Route::post('setup', 'setup');
        Route::post('verify', 'verify');
        Route::post('disable', 'disable');
        Route::post('recovery-codes', 'recoveryCodes');
    });

    Route::post('account/2fa/login/verify', [TwoFactorAuthenticationController::class, 'loginVerify'])->withoutMiddleware('auth');
});

Route::get('/', function () {
    return view('welcome');
});
