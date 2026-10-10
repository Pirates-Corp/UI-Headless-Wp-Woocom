<?php
/**
 * Plugin Name: MyApp Product Bundle Endpoint
 * Description: Returns a product and all of its variations in a single request for the headless Next.js product page, so WordPress boots once instead of 2-3 times per page view.
 * Version: 1.0.0
 * Author: Siva
 *
 * GET /wp-json/myapp/v1/product/{slug-or-id}
 * Header: X-MyApp-Auth-Key: <MYAPP_CART_AUTH_KEY>
 * Optional query params:
 *   product_fields   — comma-separated v3 product fields to return (passed through as _fields)
 *   variation_fields — comma-separated v3 variation fields to return (passed through as _fields)
 *
 * Response: { "product": <wc/v3 product>, "variations": [<wc/v3 variation>, ...] }
 *
 * The payload is produced by dispatching the *same* wc/v3 requests internally
 * (rest_do_request), so the JSON shape, ordering and status rules are identical
 * to what lib/woocommerce/api.ts already normalizes — only the number of
 * HTTP round trips / WordPress bootstraps changes.
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Retrieve the shared internal API key (same secret as the cart/shipping endpoints).
 *
 * @return string
 */
if (!function_exists('myapp_get_product_auth_key')) {
    function myapp_get_product_auth_key() {
        if (defined('MYAPP_CART_AUTH_KEY') && is_string(MYAPP_CART_AUTH_KEY) && MYAPP_CART_AUTH_KEY !== '') {
            return MYAPP_CART_AUTH_KEY;
        }

        $env_key = getenv('MYAPP_CART_AUTH_KEY');
        if (is_string($env_key) && $env_key !== '') {
            return $env_key;
        }

        return '';
    }
}

/**
 * Permission callback: the caller must send the shared key in a header.
 * (A header keeps the secret out of web-server access logs.)
 *
 * @param WP_REST_Request $request
 * @return true|WP_Error
 */
function myapp_product_bundle_permission(WP_REST_Request $request) {
    $configured_key = myapp_get_product_auth_key();
    $provided_key   = $request->get_header('x_myapp_auth_key');

    if ($configured_key !== '' && is_string($provided_key) && $provided_key !== '' && hash_equals($configured_key, $provided_key)) {
        return true;
    }

    return new WP_Error(
        'myapp_unauthorized',
        'Unauthorized: invalid or missing X-MyApp-Auth-Key header.',
        ['status' => 401]
    );
}

/**
 * Sanitize a comma-separated _fields list (letters, digits, underscore, dot, comma only).
 *
 * @param mixed $value
 * @return string
 */
function myapp_product_bundle_sanitize_fields($value) {
    if (!is_string($value) || $value === '') {
        return '';
    }
    return preg_replace('/[^A-Za-z0-9_.,]/', '', $value);
}

/**
 * Dispatch an internal wc/v3 GET request with read access to products granted
 * for the duration of the call only.
 *
 * The public wc/v3 product routes require `read_private_products`; this endpoint
 * is already gated by the shared key, so we allow product/variation reads for
 * this one internal dispatch and remove the filter immediately afterwards.
 *
 * @param string $route
 * @param array  $params
 * @return WP_REST_Response
 */
function myapp_product_bundle_internal_get($route, array $params = []) {
    $allow_read = function ($permission, $context, $object_id, $post_type) {
        if ($context === 'read' && in_array($post_type, ['product', 'product_variation'], true)) {
            return true;
        }
        return $permission;
    };

    $internal = new WP_REST_Request('GET', $route);
    foreach ($params as $key => $value) {
        if ($value !== '' && $value !== null) {
            $internal->set_param($key, $value);
        }
    }

    add_filter('woocommerce_rest_check_permissions', $allow_read, 10, 4);
    try {
        $response = rest_do_request($internal);
    } finally {
        remove_filter('woocommerce_rest_check_permissions', $allow_read, 10);
    }

    // rest_do_request() skips the rest_post_dispatch hooks, so apply _fields trimming explicitly.
    if (!empty($params['_fields']) && function_exists('rest_filter_response_fields')) {
        $response = rest_filter_response_fields($response, rest_get_server(), $internal);
    }

    return $response;
}

/**
 * REST callback.
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function myapp_product_bundle_endpoint(WP_REST_Request $request) {
    if (!class_exists('WooCommerce')) {
        return new WP_Error('myapp_woocommerce_missing', 'WooCommerce is not active.', ['status' => 503]);
    }

    $id_or_slug       = rawurldecode((string) $request->get_param('slug'));
    $product_fields   = myapp_product_bundle_sanitize_fields($request->get_param('product_fields'));
    $variation_fields = myapp_product_bundle_sanitize_fields($request->get_param('variation_fields'));

    // 1) Look up by slug — mirrors GET /wc/v3/products?slug=...
    $product  = null;
    $by_slug  = myapp_product_bundle_internal_get('/wc/v3/products', [
        'slug'    => sanitize_title($id_or_slug),
        '_fields' => $product_fields,
    ]);
    $slug_data = $by_slug->get_data();
    if (!$by_slug->is_error() && is_array($slug_data) && !empty($slug_data[0])) {
        $product = $slug_data[0];
    } elseif (ctype_digit($id_or_slug)) {
        // 2) Fallback: numeric ID — mirrors GET /wc/v3/products/{id}
        $by_id = myapp_product_bundle_internal_get('/wc/v3/products/' . absint($id_or_slug), [
            '_fields' => $product_fields,
        ]);
        if (!$by_id->is_error()) {
            $product = $by_id->get_data();
        }
    }

    if (empty($product) || !is_array($product)) {
        return new WP_Error('myapp_product_not_found', 'Product not found.', ['status' => 404]);
    }

    // 3) Variations — mirrors GET /wc/v3/products/{id}/variations?per_page=100
    $variations = [];
    if (
        isset($product['type'], $product['id']) &&
        $product['type'] === 'variable' &&
        !empty($product['variations'])
    ) {
        $var_response = myapp_product_bundle_internal_get(
            '/wc/v3/products/' . absint($product['id']) . '/variations',
            [
                'per_page' => 100,
                '_fields'  => $variation_fields,
            ]
        );
        $var_data = $var_response->get_data();
        if (!$var_response->is_error() && is_array($var_data)) {
            $variations = $var_data;
        }
    }

    $response = new WP_REST_Response([
        'product'    => $product,
        'variations' => $variations,
    ], 200);
    $response->header('Cache-Control', 'no-store');

    return $response;
}

add_action('rest_api_init', function () {
    register_rest_route('myapp/v1', '/product/(?P<slug>[^/]+)', [
        'methods'             => 'GET',
        'callback'            => 'myapp_product_bundle_endpoint',
        'permission_callback' => 'myapp_product_bundle_permission',
        'args'                => [
            'slug' => [
                'type'     => 'string',
                'required' => true,
            ],
            'product_fields' => [
                'type'     => 'string',
                'required' => false,
            ],
            'variation_fields' => [
                'type'     => 'string',
                'required' => false,
            ],
        ],
    ]);
});
