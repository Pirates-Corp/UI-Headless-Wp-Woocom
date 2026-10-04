<?php
/**
 * Plugin Name: MyApp Custom Email Links
 * Description: Rewrites customer-facing WooCommerce email links to the Next.js storefront.
 * Version: 1.0.0
 * Author: Siva
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Retrieve the configured Next.js storefront base URL.
 * Checks the MYAPP_STOREFRONT_URL constant from wp-config.php.
 * If undefined or empty, returns an empty string (disabling all link rewriting).
 *
 * @return string
 */
function myapp_get_storefront_base_url() {
    if (!defined('MYAPP_STOREFRONT_URL') || !is_string(MYAPP_STOREFRONT_URL)) {
        return '';
    }

    $url = trim(MYAPP_STOREFRONT_URL);
    if ($url === '') {
        return '';
    }

    return rtrim($url, '/');
}

/**
 * Retrieve the route map for the Next.js storefront.
 * Can be filtered via 'myapp_storefront_routes'.
 *
 * @return array<string, string>
 */
function myapp_get_storefront_routes() {
    $defaults = [
        'account'        => '/account',
        'orders'         => '/account/orders',
        'order_view'     => '/order-confirmation',
        'login'          => '/login',
        'reset_password' => '/reset-password',
        'shop'           => '/shop',
        'checkout'       => '/checkout',
        'product'        => '/product/{slug}',
    ];

    return apply_filters('myapp_storefront_routes', $defaults);
}

/**
 * Build a fully-qualified storefront URL for a given route key.
 * Returns an empty string if MYAPP_STOREFRONT_URL is undefined or route is not found.
 *
 * @param string               $route_key    Route identifier (e.g. 'order_view', 'account').
 * @param array<string, string>$replacements Path placeholder replacements (e.g. ['slug' => 'perfume-abc']).
 * @param array<string, string>$query        URL query parameters (e.g. ['order_id' => '123']).
 * @return string Fully qualified storefront URL or empty string.
 */
function myapp_storefront_url($route_key, $replacements = [], $query = []) {
    $base = myapp_get_storefront_base_url();
    if (empty($base)) {
        return '';
    }

    $routes = myapp_get_storefront_routes();
    if (!isset($routes[$route_key])) {
        return '';
    }

    $path = $routes[$route_key];

    if (!empty($replacements) && is_array($replacements)) {
        foreach ($replacements as $key => $val) {
            $token = '{' . trim((string) $key, '{}') . '}';
            $path = str_replace($token, rawurlencode((string) $val), $path);
        }
    }

    $url = $base . '/' . ltrim($path, '/');

    if (!empty($query) && is_array($query)) {
        $url = add_query_arg($query, $url);
    }

    return $url;
}

/**
 * Check whether an email object represents a customer-facing email (not admin-facing).
 *
 * @param mixed $email WC_Email instance or null.
 * @return bool True if customer-facing; false if admin email.
 */
function myapp_is_customer_email($email) {
    if (!$email || !is_object($email)) {
        return true;
    }

    // Use WooCommerce's built-in is_customer_email() method if available
    if (method_exists($email, 'is_customer_email')) {
        return (bool) $email->is_customer_email();
    }

    // Fallback: check email ID against known admin notification IDs
    if (isset($email->id)) {
        $admin_email_ids = ['new_order', 'cancelled_order', 'failed_order'];
        if (in_array($email->id, $admin_email_ids, true)) {
            return false;
        }
    }

    return true;
}

/**
 * Filter callback: Rewrite order view URL to storefront order confirmation page.
 *
 * @param string   $url   Default order URL.
 * @param WC_Order $order Order instance.
 * @return string
 */
function myapp_filter_email_view_order_url($url, $order) {
    if (!$order || !is_a($order, 'WC_Order')) {
        return $url;
    }

    $query = [
        'order_id'      => (string) $order->get_id(),
        'order_key'     => (string) $order->get_order_key(),
        'billing_email' => (string) $order->get_billing_email(),
        'ref'           => 'email',
    ];

    $storefront_url = myapp_storefront_url('order_view', [], $query);
    return $storefront_url ?: $url;
}

/**
 * Filter callback: Rewrite payment URL to storefront checkout.
 * Note: No dedicated pay-for-order page exists on the headless storefront;
 * customers are directed to /checkout to place a new order.
 *
 * @param string   $url   Default payment URL.
 * @param WC_Order $order Order instance.
 * @return string
 */
function myapp_filter_email_checkout_payment_url($url, $order = null) {
    $storefront_url = myapp_storefront_url('checkout');
    return $storefront_url ?: $url;
}

/**
 * Filter callback: Rewrite My Account permalink to storefront account page.
 *
 * @param string $permalink Default My Account permalink.
 * @return string
 */
function myapp_filter_email_myaccount_permalink($permalink) {
    $storefront_url = myapp_storefront_url('account');
    return $storefront_url ?: $permalink;
}

/**
 * Filter callback: Rewrite Shop permalink to storefront shop page.
 *
 * @param string $permalink Default Shop permalink.
 * @return string
 */
function myapp_filter_email_shop_permalink($permalink) {
    $storefront_url = myapp_storefront_url('shop');
    return $storefront_url ?: $permalink;
}

/**
 * Filter callback: Rewrite Checkout permalink to storefront checkout page.
 *
 * @param string $permalink Default Checkout permalink.
 * @return string
 */
function myapp_filter_email_checkout_permalink($permalink) {
    $storefront_url = myapp_storefront_url('checkout');
    return $storefront_url ?: $permalink;
}

/**
 * Filter callback: Rewrite Cart permalink to storefront checkout page.
 *
 * @param string $permalink Default Cart permalink.
 * @return string
 */
function myapp_filter_email_cart_permalink($permalink) {
    $storefront_url = myapp_storefront_url('checkout');
    return $storefront_url ?: $permalink;
}

/**
 * Filter callback: Rewrite WooCommerce account endpoints to storefront routes.
 *
 * @param string $url       Default endpoint URL.
 * @param string $endpoint  Endpoint key (e.g. 'orders', 'view-order', 'lost-password').
 * @param string $value     Endpoint value (e.g. order ID).
 * @param string $permalink Base permalink.
 * @return string
 */
function myapp_filter_email_endpoint_url($url, $endpoint, $value = '', $permalink = '') {
    if ($endpoint === 'orders') {
        $storefront_url = myapp_storefront_url('orders');
        return $storefront_url ?: $url;
    }

    if ($endpoint === 'view-order') {
        if (!empty($value) && function_exists('wc_get_order')) {
            $order = wc_get_order($value);
            if ($order && is_a($order, 'WC_Order')) {
                $query = [
                    'order_id'      => (string) $order->get_id(),
                    'order_key'     => (string) $order->get_order_key(),
                    'billing_email' => (string) $order->get_billing_email(),
                    'ref'           => 'email',
                ];
                $storefront_url = myapp_storefront_url('order_view', [], $query);
                return $storefront_url ?: $url;
            }
        }
        $storefront_url = myapp_storefront_url('orders');
        return $storefront_url ?: $url;
    }

    if ($endpoint === 'lost-password') {
        $storefront_url = myapp_storefront_url('reset_password');
        return $storefront_url ?: $url;
    }

    $storefront_url = myapp_storefront_url('account');
    return $storefront_url ?: $url;
}

/**
 * Filter callback: Rewrite order item product permalinks to storefront product pages.
 *
 * @param string                 $permalink Default product permalink.
 * @param WC_Order_Item_Product  $item      Order item instance.
 * @param WC_Order               $order     Order instance.
 * @return string
 */
function myapp_filter_email_order_item_permalink($permalink, $item, $order = null) {
    if (!$item || !is_object($item) || !method_exists($item, 'get_product')) {
        return $permalink;
    }

    $product = $item->get_product();
    if (!$product || !is_a($product, 'WC_Product')) {
        return $permalink;
    }

    $slug = '';
    if ($product->is_type('variation') && method_exists($product, 'get_parent_id')) {
        $parent_id = $product->get_parent_id();
        if ($parent_id && function_exists('wc_get_product')) {
            $parent = wc_get_product($parent_id);
            if ($parent && is_a($parent, 'WC_Product')) {
                $slug = $parent->get_slug();
            }
        }
    }

    if (empty($slug)) {
        $slug = $product->get_slug();
    }

    if (!empty($slug)) {
        $storefront_url = myapp_storefront_url('product', ['slug' => $slug]);
        return $storefront_url ?: $permalink;
    }

    return $permalink;
}

/**
 * Filter callback: Rewrite lost password URL during email rendering.
 *
 * @param string $lostpassword_url Default lost password URL.
 * @param string $redirect         Optional redirect URL.
 * @return string
 */
function myapp_filter_email_lostpassword_url($lostpassword_url, $redirect = '') {
    $storefront_url = myapp_storefront_url('reset_password');
    return $storefront_url ?: $lostpassword_url;
}

/**
 * Filter callback: Rewrite login URL during email rendering.
 *
 * @param string $login_url Default login URL.
 * @param string $redirect  Optional redirect URL.
 * @return string
 */
function myapp_filter_email_login_url($login_url, $redirect = '') {
    $storefront_url = myapp_storefront_url('login');
    return $storefront_url ?: $login_url;
}

/**
 * Attach URL rewriting filters when a customer-facing email starts rendering.
 *
 * @param string $email_heading Email heading.
 * @param mixed  $email         WC_Email instance or null.
 */
function myapp_email_header_hook($email_heading = '', $email = null) {
    // If MYAPP_STOREFRONT_URL is not configured, do not attach filters.
    if (empty(myapp_get_storefront_base_url())) {
        return;
    }

    // Keep backend wp-admin links for admin-facing notification emails.
    if (!myapp_is_customer_email($email)) {
        return;
    }

    add_filter('woocommerce_get_view_order_url', 'myapp_filter_email_view_order_url', 999, 2);
    add_filter('woocommerce_get_checkout_payment_url', 'myapp_filter_email_checkout_payment_url', 999, 2);
    add_filter('woocommerce_get_myaccount_page_permalink', 'myapp_filter_email_myaccount_permalink', 999, 1);
    add_filter('woocommerce_get_shop_page_permalink', 'myapp_filter_email_shop_permalink', 999, 1);
    add_filter('woocommerce_get_checkout_page_permalink', 'myapp_filter_email_checkout_permalink', 999, 1);
    add_filter('woocommerce_get_cart_page_permalink', 'myapp_filter_email_cart_permalink', 999, 1);
    add_filter('woocommerce_get_endpoint_url', 'myapp_filter_email_endpoint_url', 999, 4);
    add_filter('woocommerce_order_item_permalink', 'myapp_filter_email_order_item_permalink', 999, 3);
    add_filter('lostpassword_url', 'myapp_filter_email_lostpassword_url', 999, 2);
    add_filter('login_url', 'myapp_filter_email_login_url', 999, 2);
}
add_action('woocommerce_email', function($email = null) {
    myapp_email_header_hook('', $email);
}, 1, 1);
add_action('woocommerce_email_header', 'myapp_email_header_hook', 1, 2);
add_action('woocommerce_email_plain_header', 'myapp_email_header_hook', 1, 2);

/**
 * Symmetrically remove all URL rewriting filters when email rendering finishes.
 * Guarantees that wp-admin, REST API, and Store API requests are never affected.
 *
 * @param mixed $email WC_Email instance or null.
 */
function myapp_email_footer_hook($email = null) {
    remove_filter('woocommerce_get_view_order_url', 'myapp_filter_email_view_order_url', 999);
    remove_filter('woocommerce_get_checkout_payment_url', 'myapp_filter_email_checkout_payment_url', 999);
    remove_filter('woocommerce_get_myaccount_page_permalink', 'myapp_filter_email_myaccount_permalink', 999);
    remove_filter('woocommerce_get_shop_page_permalink', 'myapp_filter_email_shop_permalink', 999);
    remove_filter('woocommerce_get_checkout_page_permalink', 'myapp_filter_email_checkout_permalink', 999);
    remove_filter('woocommerce_get_cart_page_permalink', 'myapp_filter_email_cart_permalink', 999);
    remove_filter('woocommerce_get_endpoint_url', 'myapp_filter_email_endpoint_url', 999);
    remove_filter('woocommerce_order_item_permalink', 'myapp_filter_email_order_item_permalink', 999);
    remove_filter('lostpassword_url', 'myapp_filter_email_lostpassword_url', 999);
    remove_filter('login_url', 'myapp_filter_email_login_url', 999);
}
add_action('woocommerce_email_footer', 'myapp_email_footer_hook', 999, 1);
add_action('woocommerce_email_plain_footer', 'myapp_email_footer_hook', 999, 1);

/**
 * Locate email template overrides from inside the mu-plugin if present.
 * Allows overriding customer-new-account templates without any theme dependency.
 *
 * @param string $template      Template file path.
 * @param string $template_name Template name (e.g. 'emails/customer-new-account.php').
 * @param string $template_path Template path.
 * @return string
 */
function myapp_locate_email_template($template, $template_name, $template_path) {
    if (empty(myapp_get_storefront_base_url())) {
        return $template;
    }

    $mu_template = plugin_dir_path(__FILE__) . 'templates/' . $template_name;
    if (file_exists($mu_template)) {
        return $mu_template;
    }

    return $template;
}
add_filter('woocommerce_locate_template', 'myapp_locate_email_template', 10, 3);
