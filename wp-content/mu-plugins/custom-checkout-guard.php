<?php
/**
 * Plugin Name: MyApp Checkout Guard
 * Description: Restricts WooCommerce Store API checkout and classic checkout to requests originating from the Next.js storefront.
 * Version: 1.0.0
 * Author: Siva
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Guard Store API checkout routes via rest_pre_dispatch.
 *
 * @param mixed           $result  Response to replace the requested route with.
 * @param WP_REST_Server  $server  Server instance.
 * @param WP_REST_Request $request Request used to generate the response.
 * @return mixed
 */
function myapp_checkout_guard_rest_pre_dispatch($result, $server, $request) {
    // 2. If $result is already non-null, return it unchanged.
    if ($result !== null) {
        return $result;
    }

    // 8. Escape hatch: if MYAPP_CHECKOUT_GUARD_DISABLED is defined and true, skip the guard entirely.
    if (defined('MYAPP_CHECKOUT_GUARD_DISABLED') && MYAPP_CHECKOUT_GUARD_DISABLED) {
        return $result;
    }

    // 3. Apply the guard only when both are true:
    // Route matches #^/wc/store(/v\d+)?/checkout(/|$)# and method is not GET, HEAD or OPTIONS.
    $route = $request->get_route();
    if (!preg_match('#^/wc/store(/v\d+)?/checkout(/|$)#', $route)) {
        return $result;
    }

    $method = $request->get_method();
    if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
        return $result;
    }

    // 5. Get the configured key with myapp_get_cart_auth_key(), guarded by function_exists().
    if (!function_exists('myapp_get_cart_auth_key')) {
        error_log('[myapp_checkout_guard] Helper function myapp_get_cart_auth_key() is missing.');
        return new WP_Error(
            'myapp_checkout_guard_misconfigured',
            'Checkout guard misconfigured on server.',
            ['status' => 500]
        );
    }

    $configured_key = myapp_get_cart_auth_key();
    // 6. Fail closed: key not configured
    if (empty($configured_key) || !is_string($configured_key)) {
        error_log('[myapp_checkout_guard] Configured cart auth key is empty or missing.');
        return new WP_Error(
            'myapp_checkout_guard_misconfigured',
            'Checkout guard misconfigured on server.',
            ['status' => 500]
        );
    }

    // 4. Read the header X-MyApp-Checkout-Key
    $header_key = $request->get_header('x_myapp_checkout_key');

    // 6. Header missing or not matching (compare with hash_equals())
    if (empty($header_key) || !is_string($header_key) || !hash_equals($configured_key, $header_key)) {
        return new WP_Error(
            'myapp_checkout_forbidden',
            'Checkout is only available through the storefront.',
            ['status' => 403]
        );
    }

    // 7. Otherwise return $result unchanged.
    return $result;
}
add_filter('rest_pre_dispatch', 'myapp_checkout_guard_rest_pre_dispatch', 10, 3);

/**
 * 9. Also block the classic WooCommerce checkout.
 * Hook woocommerce_before_checkout_process and throw an Exception with the same message,
 * unless the escape hatch constant is set.
 *
 * @throws Exception
 */
function myapp_checkout_guard_block_classic_checkout() {
    if (defined('MYAPP_CHECKOUT_GUARD_DISABLED') && MYAPP_CHECKOUT_GUARD_DISABLED) {
        return;
    }

    throw new Exception('Checkout is only available through the storefront.');
}
add_action('woocommerce_before_checkout_process', 'myapp_checkout_guard_block_classic_checkout');
