<?php
/**
 * Plugin Name: MyApp Payment Idempotency & Confirmation Endpoint
 * Description: Custom REST API endpoints for secure, idempotent, and amount-safe payment confirmation and status updates for Razorpay and Stripe.
 * Version: 1.0.0
 * Author: Siva
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Retrieve the configured internal Payment API AUTH_KEY.
 * Reads dedicated MYAPP_PAYMENT_AUTH_KEY only. Does NOT fall back to WP AUTH_KEY.
 *
 * @return string
 */
if (!function_exists('myapp_get_payment_auth_key')) {
    function myapp_get_payment_auth_key() {
        if (defined('MYAPP_PAYMENT_AUTH_KEY') && is_string(MYAPP_PAYMENT_AUTH_KEY) && MYAPP_PAYMENT_AUTH_KEY !== '') {
            return MYAPP_PAYMENT_AUTH_KEY;
        }

        $env_key = getenv('MYAPP_PAYMENT_AUTH_KEY');
        if ($env_key !== false && is_string($env_key) && $env_key !== '') {
            return $env_key;
        }

        return '';
    }
}

/**
 * Validate payment API request auth key against configured secret using constant-time comparison.
 * Reads exclusively from the 'x-auth-key' header.
 *
 * @param WP_REST_Request $request
 * @return bool
 */
if (!function_exists('myapp_validate_payment_auth')) {
    function myapp_validate_payment_auth(WP_REST_Request $request) {
        $configured_key = myapp_get_payment_auth_key();
        if (empty($configured_key)) {
            return false;
        }

        $provided_key = $request->get_header('x-auth-key');
        if (empty($provided_key) || !is_string($provided_key)) {
            return false;
        }

        return hash_equals($configured_key, $provided_key);
    }
}

/**
 * Helper to compute minor currency units (e.g. cents/paise) from a major amount.
 *
 * @param float|int|string $total
 * @param string $currency
 * @return int
 */
if (!function_exists('myapp_minor_units')) {
    function myapp_minor_units($total, string $currency): int {
        $c = strtoupper($currency);
        $zero  = ['JPY', 'KRW', 'VND', 'CLP', 'UGX', 'XOF', 'XAF'];
        $three = ['KWD', 'BHD', 'OMR', 'JOD', 'TND'];
        $d = in_array($c, $zero, true) ? 0 : (in_array($c, $three, true) ? 3 : 2);
        return (int) round(((float) $total) * (10 ** $d));
    }
}

/**
 * Create or update the payment events table using dbDelta.
 */
if (!function_exists('myapp_create_payment_events_table')) {
    function myapp_create_payment_events_table() {
        global $wpdb;
        $table_version = '1.0.0';
        $installed_version = get_option('myapp_payment_events_db_version');

        if ($installed_version === $table_version) {
            return;
        }

        $table_name = $wpdb->prefix . 'myapp_payment_events';
        $charset_collate = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE $table_name (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            gateway varchar(20) NOT NULL,
            event_id varchar(191) NOT NULL,
            order_id bigint(20) unsigned NOT NULL,
            payment_id varchar(100) NOT NULL DEFAULT '',
            outcome varchar(30) NOT NULL,
            created_at datetime NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY gateway_event (gateway, event_id),
            KEY order_id (order_id)
        ) $charset_collate;";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta($sql);

        update_option('myapp_payment_events_db_version', $table_version);
    }
    add_action('init', 'myapp_create_payment_events_table');
}

/**
 * Register REST API routes for payment confirmation and status updates.
 */
if (!function_exists('myapp_register_payment_routes')) {
    function myapp_register_payment_routes() {
        // Ensure table exists on REST init as well
        myapp_create_payment_events_table();

        register_rest_route('myapp/v1', '/payment/confirm', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => 'myapp_handle_payment_confirm',
            'permission_callback' => function (WP_REST_Request $request) {
                if (!myapp_validate_payment_auth($request)) {
                    return new WP_Error('rest_forbidden', 'Unauthorized', ['status' => 401]);
                }
                return true;
            },
        ]);

        register_rest_route('myapp/v1', '/payment/status', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => 'myapp_handle_payment_status',
            'permission_callback' => function (WP_REST_Request $request) {
                if (!myapp_validate_payment_auth($request)) {
                    return new WP_Error('rest_forbidden', 'Unauthorized', ['status' => 401]);
                }
                return true;
            },
        ]);
    }
    add_action('rest_api_init', 'myapp_register_payment_routes');
}

/**
 * POST /myapp/v1/payment/confirm
 *
 * Confirms payment with per-order locking, event deduplication, amount matching, and payment_complete().
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response
 */
if (!function_exists('myapp_handle_payment_confirm')) {
    function myapp_handle_payment_confirm(WP_REST_Request $request) {
        global $wpdb;
        $logger = function_exists('wc_get_logger') ? wc_get_logger() : null;

        $params = $request->get_json_params();
        if (empty($params) || !is_array($params)) {
            return new WP_REST_Response(['ok' => false, 'code' => 'invalid_body', 'message' => 'Invalid JSON body'], 400);
        }

        $gateway      = isset($params['gateway']) ? strtolower(trim((string) $params['gateway'])) : '';
        $event_id     = isset($params['event_id']) ? trim((string) $params['event_id']) : '';
        $wc_order_id  = isset($params['wc_order_id']) ? (int) $params['wc_order_id'] : 0;
        $payment_id   = isset($params['payment_id']) ? trim((string) $params['payment_id']) : '';
        $amount_minor = isset($params['amount_minor']) ? (int) $params['amount_minor'] : 0;
        $currency     = isset($params['currency']) ? strtoupper(trim((string) $params['currency'])) : '';
        $source       = isset($params['source']) ? trim((string) $params['source']) : '';

        // Validation
        if (!in_array($gateway, ['razorpay', 'stripe'], true)) {
            return new WP_REST_Response(['ok' => false, 'code' => 'invalid_gateway'], 400);
        }
        if (empty($event_id) || empty($payment_id) || !in_array($source, ['webhook', 'verify'], true)) {
            return new WP_REST_Response(['ok' => false, 'code' => 'invalid_params'], 400);
        }
        if ($wc_order_id <= 0 || $amount_minor <= 0) {
            return new WP_REST_Response(['ok' => false, 'code' => 'invalid_numeric_values'], 400);
        }
        if (!preg_match('/^[A-Z]{3}$/', $currency)) {
            return new WP_REST_Response(['ok' => false, 'code' => 'invalid_currency'], 400);
        }

        $lock_name = 'myapp_pay_' . $wc_order_id;
        $locked = $wpdb->get_var($wpdb->prepare("SELECT GET_LOCK(%s, 10)", $lock_name));

        if ($locked !== '1' && $locked !== 1 && $locked !== true) {
            if ($logger) {
                $logger->warning("Could not acquire lock for order {$wc_order_id}", ['source' => 'myapp-payments']);
            }
            return new WP_REST_Response(['ok' => false, 'code' => 'lock_timeout', 'message' => 'Could not acquire lock'], 503);
        }

        try {
            if (function_exists('clean_post_cache')) {
                clean_post_cache($wc_order_id);
            }

            $order = wc_get_order($wc_order_id);
            if (!$order) {
                if ($logger) {
                    $logger->error("Order not found for ID {$wc_order_id}", ['source' => 'myapp-payments']);
                }
                return new WP_REST_Response(['ok' => false, 'code' => 'order_not_found'], 404);
            }

            $table_name = $wpdb->prefix . 'myapp_payment_events';

            // Claim event with INSERT IGNORE (outcome: received)
            $wpdb->query($wpdb->prepare(
                "INSERT IGNORE INTO {$table_name} (gateway, event_id, order_id, payment_id, outcome, created_at) VALUES (%s, %s, %d, %s, %s, %s)",
                $gateway, $event_id, $wc_order_id, $payment_id, 'received', current_time('mysql', 1)
            ));

            $existing = $wpdb->get_row($wpdb->prepare(
                "SELECT * FROM {$table_name} WHERE gateway = %s AND event_id = %s",
                $gateway, $event_id
            ));

            if ($existing && $existing->outcome !== 'received') {
                if ($logger) {
                    $logger->info("Duplicate event {$gateway}:{$event_id} for order {$wc_order_id} (outcome: {$existing->outcome})", ['source' => 'myapp-payments']);
                }
                return new WP_REST_Response(['ok' => true, 'result' => 'duplicate'], 200);
            }

            // Check if already paid
            if ($order->is_paid()) {
                $wpdb->update(
                    $table_name,
                    ['outcome' => 'already_paid', 'payment_id' => $payment_id],
                    ['gateway' => $gateway, 'event_id' => $event_id]
                );

                $stored_tx_id = $order->get_transaction_id();
                if (!empty($stored_tx_id) && $stored_tx_id !== $payment_id) {
                    $order->add_order_note(sprintf('Second payment %s on an already-paid order, review for refund', $payment_id));
                    $order->save();
                }

                if ($logger) {
                    $logger->info("Order {$wc_order_id} already paid. Event {$event_id} marked already_paid.", ['source' => 'myapp-payments']);
                }
                return new WP_REST_Response(['ok' => true, 'result' => 'already_paid'], 200);
            }

            // Amount and currency check
            $expected = myapp_minor_units($order->get_total(), $order->get_currency());
            $order_currency = strtoupper($order->get_currency());

            if ($order_currency !== $currency || $expected !== $amount_minor) {
                $order->add_order_note(sprintf(
                    'Payment mismatch rejected: Expected %s %d minor units, received %s %d minor units (Payment ID: %s, Gateway: %s).',
                    $order_currency, $expected, $currency, $amount_minor, $payment_id, $gateway
                ));

                if (in_array($order->get_status(), ['pending', 'failed'], true)) {
                    $order->update_status('on-hold', 'Payment amount/currency mismatch.');
                }
                $order->save();

                $wpdb->update(
                    $table_name,
                    ['outcome' => 'rejected', 'payment_id' => $payment_id],
                    ['gateway' => $gateway, 'event_id' => $event_id]
                );

                $err_code = ($order_currency !== $currency) ? 'currency_mismatch' : 'amount_mismatch';
                if ($logger) {
                    $logger->error("Payment mismatch for order {$wc_order_id}: expected {$order_currency} {$expected}, received {$currency} {$amount_minor}", ['source' => 'myapp-payments']);
                }
                return new WP_REST_Response(['ok' => false, 'code' => $err_code], 409);
            }

            // Execute payment completion
            $order->payment_complete($payment_id);
            $order->update_meta_data('_myapp_gateway', $gateway);
            $order->update_meta_data('_myapp_gateway_event_id', $event_id);
            $order->add_order_note(sprintf('Payment confirmed via %s (%s %s)', $source, $gateway, $payment_id));
            $order->save();

            $wpdb->update(
                $table_name,
                ['outcome' => 'paid', 'payment_id' => $payment_id],
                ['gateway' => $gateway, 'event_id' => $event_id]
            );

            if ($logger) {
                $logger->info("Payment successfully confirmed for order {$wc_order_id} via {$gateway} (Tx: {$payment_id})", ['source' => 'myapp-payments']);
            }

            return new WP_REST_Response(['ok' => true, 'result' => 'paid'], 200);
        } catch (Exception $e) {
            if ($logger) {
                $logger->error("Exception confirming payment for order {$wc_order_id}: " . $e->getMessage(), ['source' => 'myapp-payments']);
            }
            return new WP_REST_Response(['ok' => false, 'code' => 'server_error', 'message' => 'Internal server error'], 500);
        } finally {
            $wpdb->query($wpdb->prepare("SELECT RELEASE_LOCK(%s)", $lock_name));
        }
    }
}

/**
 * POST /myapp/v1/payment/status
 *
 * Forward-only order status transitions for non-payment events (failed | cancelled | on-hold).
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response
 */
if (!function_exists('myapp_handle_payment_status')) {
    function myapp_handle_payment_status(WP_REST_Request $request) {
        global $wpdb;
        $logger = function_exists('wc_get_logger') ? wc_get_logger() : null;

        $params = $request->get_json_params();
        if (empty($params) || !is_array($params)) {
            return new WP_REST_Response(['ok' => false, 'code' => 'invalid_body', 'message' => 'Invalid JSON body'], 400);
        }

        $gateway     = isset($params['gateway']) ? strtolower(trim((string) $params['gateway'])) : '';
        $event_id    = isset($params['event_id']) ? trim((string) $params['event_id']) : '';
        $wc_order_id = isset($params['wc_order_id']) ? (int) $params['wc_order_id'] : 0;
        $payment_id  = isset($params['payment_id']) ? trim((string) $params['payment_id']) : '';
        $status      = isset($params['status']) ? strtolower(trim((string) $params['status'])) : '';
        $reason      = isset($params['reason']) ? trim((string) $params['reason']) : '';

        // Validation
        if (!in_array($gateway, ['razorpay', 'stripe'], true)) {
            return new WP_REST_Response(['ok' => false, 'code' => 'invalid_gateway'], 400);
        }
        if (empty($event_id) || $wc_order_id <= 0) {
            return new WP_REST_Response(['ok' => false, 'code' => 'invalid_params'], 400);
        }
        if (!in_array($status, ['failed', 'cancelled', 'on-hold'], true)) {
            return new WP_REST_Response(['ok' => false, 'code' => 'invalid_status'], 400);
        }

        $lock_name = 'myapp_pay_' . $wc_order_id;
        $locked = $wpdb->get_var($wpdb->prepare("SELECT GET_LOCK(%s, 10)", $lock_name));

        if ($locked !== '1' && $locked !== 1 && $locked !== true) {
            if ($logger) {
                $logger->warning("Could not acquire lock for order {$wc_order_id} in status update", ['source' => 'myapp-payments']);
            }
            return new WP_REST_Response(['ok' => false, 'code' => 'lock_timeout', 'message' => 'Could not acquire lock'], 503);
        }

        try {
            if (function_exists('clean_post_cache')) {
                clean_post_cache($wc_order_id);
            }

            $order = wc_get_order($wc_order_id);
            if (!$order) {
                if ($logger) {
                    $logger->error("Order not found for ID {$wc_order_id}", ['source' => 'myapp-payments']);
                }
                return new WP_REST_Response(['ok' => false, 'code' => 'order_not_found'], 404);
            }

            $table_name = $wpdb->prefix . 'myapp_payment_events';

            // Claim event with INSERT IGNORE
            $wpdb->query($wpdb->prepare(
                "INSERT IGNORE INTO {$table_name} (gateway, event_id, order_id, payment_id, outcome, created_at) VALUES (%s, %s, %d, %s, %s, %s)",
                $gateway, $event_id, $wc_order_id, $payment_id, 'received', current_time('mysql', 1)
            ));

            $existing = $wpdb->get_row($wpdb->prepare(
                "SELECT * FROM {$table_name} WHERE gateway = %s AND event_id = %s",
                $gateway, $event_id
            ));

            if ($existing && $existing->outcome !== 'received') {
                if ($logger) {
                    $logger->info("Duplicate status event {$gateway}:{$event_id} for order {$wc_order_id}", ['source' => 'myapp-payments']);
                }
                return new WP_REST_Response(['ok' => true, 'result' => 'duplicate'], 200);
            }

            $curr_status = $order->get_status();

            // Forward-only rules:
            // If the order is paid or status is processing/completed/refunded: ignore
            if ($order->is_paid() || in_array($curr_status, ['processing', 'completed', 'refunded'], true)) {
                $wpdb->update(
                    $table_name,
                    ['outcome' => 'ignored', 'payment_id' => $payment_id],
                    ['gateway' => $gateway, 'event_id' => $event_id]
                );
                if ($logger) {
                    $logger->info("Order {$wc_order_id} is paid or terminal ({$curr_status}). Status update to {$status} ignored.", ['source' => 'myapp-payments']);
                }
                return new WP_REST_Response(['ok' => true, 'result' => 'ignored'], 200);
            }

            // Allowed transitions:
            // failed: from pending or on-hold
            // cancelled: from pending, failed, on-hold
            // on-hold: from pending or failed
            $allowed = false;
            if ($status === 'failed' && in_array($curr_status, ['pending', 'on-hold'], true)) {
                $allowed = true;
            } elseif ($status === 'cancelled' && in_array($curr_status, ['pending', 'failed', 'on-hold'], true)) {
                $allowed = true;
            } elseif ($status === 'on-hold' && in_array($curr_status, ['pending', 'failed'], true)) {
                $allowed = true;
            }

            if (!$allowed) {
                $wpdb->update(
                    $table_name,
                    ['outcome' => 'ignored', 'payment_id' => $payment_id],
                    ['gateway' => $gateway, 'event_id' => $event_id]
                );
                if ($logger) {
                    $logger->info("Transition from {$curr_status} to {$status} not allowed for order {$wc_order_id}. Ignored.", ['source' => 'myapp-payments']);
                }
                return new WP_REST_Response(['ok' => true, 'result' => 'ignored'], 200);
            }

            // Real transition
            $note = sprintf('Payment status updated to %s via %s', $status, $gateway);
            if (!empty($reason)) {
                $note .= ': ' . $reason;
            }
            if (!empty($payment_id)) {
                $note .= sprintf(' (Payment ID: %s)', $payment_id);
            }

            $order->update_status($status, $note);
            $order->update_meta_data('_myapp_gateway', $gateway);
            $order->update_meta_data('_myapp_gateway_event_id', $event_id);
            $order->save();

            $wpdb->update(
                $table_name,
                ['outcome' => 'ignored', 'payment_id' => $payment_id],
                ['gateway' => $gateway, 'event_id' => $event_id]
            );

            if ($logger) {
                $logger->info("Order {$wc_order_id} status updated to {$status} via {$gateway}", ['source' => 'myapp-payments']);
            }

            return new WP_REST_Response(['ok' => true, 'result' => 'ignored'], 200);
        } catch (Exception $e) {
            if ($logger) {
                $logger->error("Exception updating status for order {$wc_order_id}: " . $e->getMessage(), ['source' => 'myapp-payments']);
            }
            return new WP_REST_Response(['ok' => false, 'code' => 'server_error', 'message' => 'Internal server error'], 500);
        } finally {
            $wpdb->query($wpdb->prepare("SELECT RELEASE_LOCK(%s)", $lock_name));
        }
    }
}
