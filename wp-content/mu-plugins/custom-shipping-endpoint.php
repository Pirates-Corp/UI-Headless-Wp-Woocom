<?php
/**
 * Plugin Name: MyApp Shiprocket & Shipping Tracking Endpoints
 * Description: Custom REST API endpoints to receive Shiprocket tracking webhooks, save tracking metadata to WooCommerce orders, automate order statuses, and securely expose tracking to the headless Next.js frontend.
 * Version: 1.1.0
 * Author: Siva
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Register custom WooCommerce order statuses for automated shipping.
 */
add_action('init', function () {
    register_post_status('wc-shipped', [
        'label'                     => _x('Shipped', 'Order status', 'woocommerce'),
        'public'                    => true,
        'exclude_from_search'       => false,
        'show_in_admin_all_list'    => true,
        'show_in_admin_status_list' => true,
        'label_count'               => _n_noop('Shipped <span class="count">(%s)</span>', 'Shipped <span class="count">(%s)</span>', 'woocommerce'),
    ]);

    register_post_status('wc-rto', [
        'label'                     => _x('Returned to origin', 'Order status', 'woocommerce'),
        'public'                    => true,
        'exclude_from_search'       => false,
        'show_in_admin_all_list'    => true,
        'show_in_admin_status_list' => true,
        'label_count'               => _n_noop('Returned to origin <span class="count">(%s)</span>', 'Returned to origin <span class="count">(%s)</span>', 'woocommerce'),
    ]);
});

/**
 * Add custom statuses to WooCommerce order status list.
 */
add_filter('wc_order_statuses', function ($order_statuses) {
    $new_statuses = [];
    foreach ($order_statuses as $key => $status) {
        $new_statuses[$key] = $status;
        if ($key === 'wc-processing') {
            $new_statuses['wc-shipped'] = _x('Shipped', 'Order status', 'woocommerce');
        }
        if ($key === 'wc-completed') {
            $new_statuses['wc-rto'] = _x('Returned to origin', 'Order status', 'woocommerce');
        }
    }
    if (!isset($new_statuses['wc-shipped'])) {
        $new_statuses['wc-shipped'] = _x('Shipped', 'Order status', 'woocommerce');
    }
    if (!isset($new_statuses['wc-rto'])) {
        $new_statuses['wc-rto'] = _x('Returned to origin', 'Order status', 'woocommerce');
    }
    return $new_statuses;
});

/**
 * Treat 'shipped' as a paid status.
 */
add_filter('woocommerce_order_is_paid_statuses', function ($statuses) {
    if (!in_array('shipped', $statuses, true)) {
        $statuses[] = 'shipped';
    }
    return $statuses;
});

/**
 * Retrieve the configured persistent cart / internal API AUTH_KEY.
 *
 * @return string
 */
if (!function_exists('myapp_get_shipping_cart_auth_key')) {
    function myapp_get_shipping_cart_auth_key() {
        if (defined('MYAPP_CART_AUTH_KEY') && is_string(MYAPP_CART_AUTH_KEY) && MYAPP_CART_AUTH_KEY !== '') {
            return MYAPP_CART_AUTH_KEY;
        }

        $env_key = getenv('MYAPP_CART_AUTH_KEY');
        if ($env_key !== false && is_string($env_key) && $env_key !== '') {
            return $env_key;
        }

        if (defined('AUTH_KEY') && is_string(AUTH_KEY) && AUTH_KEY !== '') {
            return AUTH_KEY;
        }

        return '';
    }
}

/**
 * Validate internal API request auth key against configured secret.
 *
 * @param WP_REST_Request $request
 * @return bool
 */
if (!function_exists('myapp_validate_shipping_internal_auth')) {
    function myapp_validate_shipping_internal_auth(WP_REST_Request $request) {
        $configured_key = myapp_get_shipping_cart_auth_key();
        if (empty($configured_key)) {
            return false;
        }

        $provided_key = $request->get_param('AUTH_KEY');
        if (empty($provided_key)) {
            $provided_key = $request->get_header('x-auth-key');
        }
        if (empty($provided_key)) {
            $auth_header = $request->get_header('authorization');
            if (!empty($auth_header)) {
                if (stripos($auth_header, 'Bearer ') === 0) {
                    $provided_key = trim(substr($auth_header, 7));
                } else {
                    $provided_key = trim($auth_header);
                }
            }
        }

        if (empty($provided_key) || !is_string($provided_key)) {
            return false;
        }

        return hash_equals($configured_key, $provided_key);
    }
}

/**
 * Retrieve the configured Shiprocket Webhook Secret.
 *
 * @return string
 */
function myapp_get_shiprocket_webhook_secret() {
    if (defined('SHIPROCKET_WEBHOOK_SECRET') && is_string(SHIPROCKET_WEBHOOK_SECRET) && SHIPROCKET_WEBHOOK_SECRET !== '') {
        return SHIPROCKET_WEBHOOK_SECRET;
    }

    $env_secret = getenv('SHIPROCKET_WEBHOOK_SECRET');
    if ($env_secret !== false && is_string($env_secret) && $env_secret !== '') {
        return $env_secret;
    }

    return '';
}

/**
 * Extract auth token from incoming webhook request.
 * Supports both 'x-api-key' and 'Authorization' headers as well as $_SERVER fallbacks.
 *
 * @param WP_REST_Request $request
 * @return string
 */
function myapp_extract_shiprocket_auth_token(WP_REST_Request $request) {
    // 1. Check 'x-api-key' header
    $x_api_key = $request->get_header('x-api-key');
    if (!empty($x_api_key) && is_string($x_api_key)) {
        return trim($x_api_key);
    }

    // 2. Check 'Authorization' header (raw token or Bearer token)
    $auth_header = $request->get_header('authorization');
    if (!empty($auth_header) && is_string($auth_header)) {
        if (stripos($auth_header, 'Bearer ') === 0) {
            return trim(substr($auth_header, 7));
        }
        return trim($auth_header);
    }

    // 3. Fallbacks from $_SERVER in case Apache/Nginx environment stripped headers
    if (!empty($_SERVER['HTTP_X_API_KEY']) && is_string($_SERVER['HTTP_X_API_KEY'])) {
        return trim($_SERVER['HTTP_X_API_KEY']);
    }

    if (!empty($_SERVER['HTTP_AUTHORIZATION']) && is_string($_SERVER['HTTP_AUTHORIZATION'])) {
        $server_auth = trim($_SERVER['HTTP_AUTHORIZATION']);
        if (stripos($server_auth, 'Bearer ') === 0) {
            return trim(substr($server_auth, 7));
        }
        return $server_auth;
    }

    if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION']) && is_string($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $redir_auth = trim($_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
        if (stripos($redir_auth, 'Bearer ') === 0) {
            return trim(substr($redir_auth, 7));
        }
        return $redir_auth;
    }

    return '';
}

/**
 * Find a WooCommerce order by Shiprocket channel_order_id.
 * Tries direct ID first, then order number meta, and custom order number plugins.
 *
 * @param string|int $channel_order_id
 * @return WC_Order|null
 */
function myapp_find_order_by_channel_id($channel_order_id) {
    if (empty($channel_order_id)) {
        return null;
    }

    // 1. Try as a numeric WC order ID
    $order_id_num = (int) $channel_order_id;
    if ($order_id_num > 0 && function_exists('wc_get_order')) {
        $order = wc_get_order($order_id_num);
        if ($order instanceof WC_Order) {
            return $order;
        }
    }

    // 2. Search by _order_number meta (Sequential Order Numbers / custom formatting)
    if (function_exists('wc_get_orders')) {
        $orders = wc_get_orders([
            'limit'      => 1,
            'meta_key'   => '_order_number',
            'meta_value' => (string) $channel_order_id,
        ]);
        if (!empty($orders) && $orders[0] instanceof WC_Order) {
            return $orders[0];
        }

        // 3. Fallback search by standard order number
        $orders = wc_get_orders([
            'limit'        => 1,
            'order_number' => (string) $channel_order_id,
        ]);
        if (!empty($orders) && $orders[0] instanceof WC_Order) {
            return $orders[0];
        }
    }

    return null;
}

/**
 * Maps incoming Shiprocket numeric status ID and string status label to target WooCommerce status.
 *
 * @param int|string $status_id
 * @param string $status_label
 * @return string|null
 */
function myapp_map_shiprocket_status($status_id, $status_label) {
    $status_id = (int) $status_id;
    $label = strtolower(trim((string) $status_label));

    // Shiprocket Status IDs:
    // 6: SHIPPED, 17: IN TRANSIT, 18: OUT FOR DELIVERY, 42: PICKED UP, 43: HANDOVER PENDING,
    // 38: IN TRANSIT (DEST), 39: OUT FOR DELIVERY (DEST), 54: IN TRANSIT (HUB)
    $shipped_ids = [6, 17, 18, 42, 43, 38, 39, 54];
    if (in_array($status_id, $shipped_ids, true)) {
        return 'shipped';
    }

    // 19: DELIVERED, 7: DELIVERED (legacy), 40: DELIVERED (DEST)
    $delivered_ids = [19, 7, 40];
    if (in_array($status_id, $delivered_ids, true)) {
        return 'completed';
    }

    // 22: RTO INITIATED, 23: RTO DELIVERED, 24: RTO IN TRANSIT, 9: RTO (legacy),
    // 14: RTO ACK, 15: RTO NDR, 16: RTO OFD, 25: RTO NDR, 56: RTO LOCK
    $rto_ids = [22, 23, 24, 9, 14, 15, 16, 25, 56];
    if (in_array($status_id, $rto_ids, true)) {
        return 'rto';
    }

    // 21: CANCELED, 8: CANCELED (legacy), 41: CANCELLED BEFORE DISPATCH
    $cancelled_ids = [21, 8, 41];
    if (in_array($status_id, $cancelled_ids, true)) {
        return 'cancelled';
    }

    // Fallback matching on lowercase label:
    if (!empty($label)) {
        if (strpos($label, 'deliver') !== false && strpos($label, 'out for') === false && strpos($label, 'undeliver') === false && strpos($label, 'rto') === false) {
            return 'completed';
        }
        if (strpos($label, 'rto') !== false || strpos($label, 'return to origin') !== false) {
            return 'rto';
        }
        if (strpos($label, 'ship') !== false || strpos($label, 'in transit') !== false || strpos($label, 'out for delivery') !== false || strpos($label, 'picked up') !== false || strpos($label, 'handover') !== false) {
            return 'shipped';
        }
        if (strpos($label, 'cancel') !== false) {
            return 'cancelled';
        }
    }

    return null; // NDR, delayed, unmapped
}

/**
 * REST Callback: Handle incoming Shiprocket tracking webhook.
 * POST /wp-json/myapp/v1/shipping/shiprocket/webhook
 * POST /wp-json/myapp/v1/shipping/webhook
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response
 */
function myapp_handle_shiprocket_webhook(WP_REST_Request $request) {
    $expected_secret = myapp_get_shiprocket_webhook_secret();
    $sent_token = myapp_extract_shiprocket_auth_token($request);

    // If secret is not configured or token verification fails:
    // Always return HTTP 200 with status: ignored to avoid leaking validation details or causing retry storms
    if (empty($expected_secret) || empty($sent_token) || !hash_equals($expected_secret, $sent_token)) {
        error_log('[Shiprocket Webhook] Auth token validation failed or secret missing.');
        return new WP_REST_Response(['status' => 'ignored', 'reason' => 'unauthorized'], 200);
    }

    $raw_body = $request->get_body();
    $body = json_decode($raw_body, true);

    if (!is_array($body)) {
        return new WP_REST_Response(['status' => 'ignored', 'reason' => 'invalid_json'], 200);
    }

    // Extract channel order identifier
    $channel_order_id = $body['channel_order_id'] ?? ($body['order_id'] ?? '');
    if (empty($channel_order_id)) {
        return new WP_REST_Response(['status' => 'ignored', 'reason' => 'missing_order_id'], 200);
    }

    $order = myapp_find_order_by_channel_id($channel_order_id);
    if (!$order) {
        error_log('[Shiprocket Webhook] No matching order found for channel_order_id: ' . $channel_order_id);
        return new WP_REST_Response(['status' => 'ok', 'message' => 'order_not_found'], 200);
    }

    // Sanitize and extract tracking parameters
    $awb                = sanitize_text_field((string) ($body['awb'] ?? ''));
    $current_status     = sanitize_text_field((string) ($body['current_status'] ?? ($body['shipment_status'] ?? '')));
    $current_status_id  = intval($body['current_status_id'] ?? ($body['shipment_status_id'] ?? 0));
    $courier_name       = sanitize_text_field((string) ($body['courier_name'] ?? ''));
    $etd                = sanitize_text_field((string) ($body['etd'] ?? ''));
    $raw_scans          = isset($body['scans']) && is_array($body['scans']) ? $body['scans'] : [];

    // Sanitize scans array
    $sanitized_scans = [];
    foreach ($raw_scans as $scan) {
        if (!is_array($scan)) {
            continue;
        }
        $sanitized_scans[] = [
            'date'            => sanitize_text_field((string) ($scan['date'] ?? '')),
            'activity'        => sanitize_text_field((string) ($scan['activity'] ?? ($scan['status'] ?? ''))),
            'location'        => sanitize_text_field((string) ($scan['location'] ?? '')),
            'sr_status_label' => sanitize_text_field((string) ($scan['sr-status-label'] ?? ($scan['sr_status_label'] ?? ''))),
        ];
    }

    // Persist metadata on the WooCommerce Order
    if (!empty($awb)) {
        $order->update_meta_data('_myapp_shiprocket_awb', $awb);
    }
    if (!empty($current_status)) {
        $order->update_meta_data('_myapp_shiprocket_status', $current_status);
    }
    if ($current_status_id > 0) {
        $order->update_meta_data('_myapp_shiprocket_status_id', $current_status_id);
    }
    if (!empty($courier_name)) {
        $order->update_meta_data('_myapp_shiprocket_courier', $courier_name);
    }
    if (!empty($etd)) {
        $order->update_meta_data('_myapp_shiprocket_etd', $etd);
    }

    $order->update_meta_data('_myapp_shiprocket_scans', wp_json_encode($sanitized_scans));
    $order->update_meta_data('_myapp_shiprocket_updated_at', current_time('mysql'));

    // Status mapping & safety transition rules
    $target_status = myapp_map_shiprocket_status($current_status_id, $current_status);
    if (!empty($target_status)) {
        $raw_current = strtolower(str_replace('wc-', '', (string) $order->get_status()));

        // Locked terminal statuses that must never change from shipping webhook
        $is_locked = in_array($raw_current, ['cancelled', 'refunded'], true) || (strpos($raw_current, 'return-') === 0);

        if (!$is_locked) {
            $status_ranks = [
                'pending'    => 1,
                'on-hold'    => 2,
                'processing' => 3,
                'shipped'    => 4,
                'completed'  => 5,
            ];

            $current_rank = $status_ranks[$raw_current] ?? null;
            $target_rank = $status_ranks[$target_status] ?? null;

            // Handle RTO transition specifically
            if ($target_status === 'rto') {
                if ($raw_current !== 'rto') {
                    // Check if prepaid
                    $tx_id = (string) $order->get_transaction_id();
                    $payment_method = strtolower((string) $order->get_payment_method());
                    $is_prepaid = (!empty($tx_id) && $payment_method !== 'cod' && $payment_method !== 'bacs') ||
                                  (!empty($order->get_date_paid()) && $payment_method !== 'cod');

                    if ($is_prepaid) {
                        $order->update_meta_data('_myapp_refund_pending', 1);
                        $order->add_order_note('RTO on prepaid order, refund required');
                    }

                    $order->update_status('rto', 'Shiprocket: ' . ($current_status ?: 'RTO'));
                }
            } elseif ($target_status === 'completed') {
                // Moving to completed (Delivered)
                if ($current_rank !== null && $target_rank !== null && $target_rank < $current_rank) {
                    // Ignore rank downgrade
                    error_log(sprintf('[Shiprocket Webhook] Ignored downgrade for order %d from %s to %s', $order->get_id(), $raw_current, $target_status));
                } else {
                    if (empty($order->get_meta('_myapp_delivered_at'))) {
                        $order->update_meta_data('_myapp_delivered_at', gmdate('c'));
                    }
                    if ($raw_current !== 'completed') {
                        $order->update_status('completed', 'Shiprocket: ' . ($current_status ?: 'Delivered'));
                    }
                }
            } elseif ($target_status === 'shipped') {
                if ($current_rank !== null && $target_rank !== null && $target_rank < $current_rank) {
                    // Ignore rank downgrade (e.g. if already completed)
                    error_log(sprintf('[Shiprocket Webhook] Ignored downgrade for order %d from %s to %s', $order->get_id(), $raw_current, $target_status));
                } elseif ($raw_current !== 'shipped') {
                    $order->update_status('shipped', 'Shiprocket: ' . ($current_status ?: 'Shipped'));
                }
            } elseif ($target_status === 'cancelled') {
                if ($raw_current !== 'cancelled') {
                    $order->update_status('cancelled', 'Shiprocket: ' . ($current_status ?: 'Cancelled'));
                }
            }
        }
    }

    $order->save();

    return new WP_REST_Response([
        'status'   => 'ok',
        'order_id' => $order->get_id(),
        'awb'      => $awb,
    ], 200);
}

/**
 * REST Callback: Retrieve shipment tracking details for an authenticated user.
 * GET /wp-json/myapp/v1/shipping/track/(?P<order_id>\d+)
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response
 */
function myapp_get_shipping_tracking_endpoint(WP_REST_Request $request) {
    if (!myapp_validate_shipping_internal_auth($request)) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Unauthorized: Invalid or missing AUTH_KEY.',
        ], 401);
    }

    $order_id = (int) $request['order_id'];
    if ($order_id <= 0 || !function_exists('wc_get_order')) {
        return new WP_REST_Response([
            'success' => false,
            'error'   => 'not_found',
            'message' => 'Invalid order ID.',
        ], 404);
    }

    $order = wc_get_order($order_id);
    if (!$order instanceof WC_Order) {
        return new WP_REST_Response([
            'success' => false,
            'error'   => 'not_found',
            'message' => 'Order not found.',
        ], 404);
    }

    // Customer ownership validation
    $requested_user_id = intval($request->get_param('user_id'));
    $requested_email   = sanitize_email((string) $request->get_param('email'));

    $order_customer_id = (int) $order->get_customer_id();
    $order_billing_email = strtolower(trim((string) $order->get_billing_email()));

    $owns_order = false;
    if ($requested_user_id > 0 && $order_customer_id === $requested_user_id) {
        $owns_order = true;
    } elseif (!empty($requested_email) && $order_billing_email === strtolower(trim($requested_email))) {
        $owns_order = true;
    }

    if (!$owns_order) {
        return new WP_REST_Response([
            'success' => false,
            'error'   => 'forbidden',
            'message' => 'You do not have permission to view tracking for this order.',
        ], 403);
    }

    $awb        = (string) $order->get_meta('_myapp_shiprocket_awb');
    $status     = (string) $order->get_meta('_myapp_shiprocket_status');
    $status_id  = (int) $order->get_meta('_myapp_shiprocket_status_id');
    $courier    = (string) $order->get_meta('_myapp_shiprocket_courier');
    $etd        = (string) $order->get_meta('_myapp_shiprocket_etd');
    $raw_scans  = $order->get_meta('_myapp_shiprocket_scans');
    $updated_at = (string) $order->get_meta('_myapp_shiprocket_updated_at');

    $scans = [];
    if (!empty($raw_scans)) {
        $decoded = json_decode($raw_scans, true);
        if (is_array($decoded)) {
            $scans = $decoded;
        }
    }

    $has_tracking = !empty($awb) || !empty($status) || !empty($courier) || !empty($scans);

    return new WP_REST_Response([
        'success'      => true,
        'has_tracking' => $has_tracking,
        'order_id'     => $order->get_id(),
        'order_number' => $order->get_order_number(),
        'awb'          => $awb ?: null,
        'status'       => $status ?: null,
        'status_id'    => $status_id ?: null,
        'courier'      => $courier ?: null,
        'etd'          => $etd ?: null,
        'scans'        => $scans,
        'updated_at'   => $updated_at ?: null,
    ], 200);
}

/**
 * Add Refund Pending column in WooCommerce Order List (HPOS & Classic).
 */
add_filter('manage_woocommerce_page_wc-orders_columns', 'myapp_add_order_refund_pending_column');
add_filter('manage_edit-shop_order_columns', 'myapp_add_order_refund_pending_column');
function myapp_add_order_refund_pending_column($columns) {
    $columns['myapp_refund_pending'] = __('Refund Alert', 'woocommerce');
    return $columns;
}

add_action('manage_woocommerce_page_wc-orders_custom_column', 'myapp_render_order_refund_pending_column', 10, 2);
add_action('manage_shop_order_posts_custom_column', 'myapp_render_order_refund_pending_column_classic', 10, 2);

function myapp_render_order_refund_pending_column($column_name, $order) {
    if ($column_name === 'myapp_refund_pending' && $order instanceof WC_Order) {
        $pending = $order->get_meta('_myapp_refund_pending');
        if (!empty($pending) && (string)$pending === '1') {
            echo '<mark class="order-status status-processing tips" style="background:#ffefe5;color:#d63638;font-weight:600;padding:3px 8px;border-radius:4px;">' . esc_html__('Refund Pending', 'woocommerce') . '</mark>';
        } else {
            echo '<span style="color:#a0a0a0;">—</span>';
        }
    }
}

function myapp_render_order_refund_pending_column_classic($column_name, $post_id) {
    if ($column_name === 'myapp_refund_pending') {
        $order = wc_get_order($post_id);
        if ($order instanceof WC_Order) {
            myapp_render_order_refund_pending_column($column_name, $order);
        }
    }
}

/**
 * Filter orders list by _myapp_refund_pending in WP Admin.
 */
add_action('restrict_manage_posts', 'myapp_admin_orders_filter_refund_pending');
add_action('woocommerce_order_list_table_extra_tablenav', 'myapp_admin_orders_filter_refund_pending_hpos');

function myapp_admin_orders_filter_refund_pending() {
    global $typenow;
    if ($typenow === 'shop_order') {
        myapp_render_refund_pending_filter_select();
    }
}

function myapp_admin_orders_filter_refund_pending_hpos() {
    myapp_render_refund_pending_filter_select();
}

function myapp_render_refund_pending_filter_select() {
    $current = isset($_GET['_myapp_filter_refund_pending']) ? sanitize_text_field($_GET['_myapp_filter_refund_pending']) : '';
    ?>
    <select name="_myapp_filter_refund_pending">
        <option value=""><?php esc_html_e('All Refund Statuses', 'woocommerce'); ?></option>
        <option value="1" <?php selected($current, '1'); ?>><?php esc_html_e('Refund Pending Only', 'woocommerce'); ?></option>
    </select>
    <?php
}

add_filter('woocommerce_order_list_table_prepare_items_query_args', function ($args) {
    if (!empty($_GET['_myapp_filter_refund_pending']) && $_GET['_myapp_filter_refund_pending'] === '1') {
        $meta_query = $args['meta_query'] ?? [];
        $meta_query[] = [
            'key'     => '_myapp_refund_pending',
            'value'   => 1,
            'compare' => '=',
        ];
        $args['meta_query'] = $meta_query;
    }
    return $args;
});

add_filter('request', function ($vars) {
    global $typenow;
    if ($typenow === 'shop_order' && !empty($_GET['_myapp_filter_refund_pending']) && $_GET['_myapp_filter_refund_pending'] === '1') {
        $vars['meta_query'] = [
            [
                'key'     => '_myapp_refund_pending',
                'value'   => 1,
                'compare' => '=',
            ],
        ];
    }
    return $vars;
});

/**
 * Register custom shipping REST routes.
 */
add_action('rest_api_init', function () {
    // 1. Provider-specific webhook route
    register_rest_route('myapp/v1', '/shipping/shiprocket/webhook', [
        'methods'             => 'POST',
        'callback'            => 'myapp_handle_shiprocket_webhook',
        'permission_callback' => '__return_true',
    ]);

    // 2. Generic shipping webhook route (safe alias to avoid panel keyword restrictions if needed)
    register_rest_route('myapp/v1', '/shipping/webhook', [
        'methods'             => 'POST',
        'callback'            => 'myapp_handle_shiprocket_webhook',
        'permission_callback' => '__return_true',
    ]);

    // 3. Frontend authenticated tracking read endpoint
    register_rest_route('myapp/v1', '/shipping/track/(?P<order_id>\d+)', [
        'methods'             => 'GET',
        'callback'            => 'myapp_get_shipping_tracking_endpoint',
        'permission_callback' => '__return_true',
    ]);
});

