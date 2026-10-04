<?php
/**
 * Plugin Name: MyApp Customer Returns & Reverse Logistics Endpoint
 * Description: Custom REST API endpoint and order workflow for customer return requests, admin approvals, receipt tracking, and automatic refund triggers.
 * Version: 1.0.0
 * Author: Siva
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!defined('MYAPP_RETURN_WINDOW_DAYS')) {
    define('MYAPP_RETURN_WINDOW_DAYS', 7);
}

/**
 * Register custom WooCommerce order statuses for returns workflow.
 */
add_action('init', function () {
    register_post_status('wc-return-requested', [
        'label'                     => _x('Return Requested', 'Order status', 'woocommerce'),
        'public'                    => true,
        'exclude_from_search'       => false,
        'show_in_admin_all_list'    => true,
        'show_in_admin_status_list' => true,
        'label_count'               => _n_noop('Return Requested <span class="count">(%s)</span>', 'Return Requested <span class="count">(%s)</span>', 'woocommerce'),
    ]);

    register_post_status('wc-return-approved', [
        'label'                     => _x('Return Approved', 'Order status', 'woocommerce'),
        'public'                    => true,
        'exclude_from_search'       => false,
        'show_in_admin_all_list'    => true,
        'show_in_admin_status_list' => true,
        'label_count'               => _n_noop('Return Approved <span class="count">(%s)</span>', 'Return Approved <span class="count">(%s)</span>', 'woocommerce'),
    ]);

    register_post_status('wc-return-received', [
        'label'                     => _x('Return Received', 'Order status', 'woocommerce'),
        'public'                    => true,
        'exclude_from_search'       => false,
        'show_in_admin_all_list'    => true,
        'show_in_admin_status_list' => true,
        'label_count'               => _n_noop('Return Received <span class="count">(%s)</span>', 'Return Received <span class="count">(%s)</span>', 'woocommerce'),
    ]);

    register_post_status('wc-return-rejected', [
        'label'                     => _x('Return Rejected', 'Order status', 'woocommerce'),
        'public'                    => true,
        'exclude_from_search'       => false,
        'show_in_admin_all_list'    => true,
        'show_in_admin_status_list' => true,
        'label_count'               => _n_noop('Return Rejected <span class="count">(%s)</span>', 'Return Rejected <span class="count">(%s)</span>', 'woocommerce'),
    ]);
});

/**
 * Add custom return statuses to WooCommerce order status list.
 */
add_filter('wc_order_statuses', function ($order_statuses) {
    $order_statuses['wc-return-requested'] = _x('Return Requested', 'Order status', 'woocommerce');
    $order_statuses['wc-return-approved']  = _x('Return Approved', 'Order status', 'woocommerce');
    $order_statuses['wc-return-received']  = _x('Return Received', 'Order status', 'woocommerce');
    $order_statuses['wc-return-rejected']  = _x('Return Rejected', 'Order status', 'woocommerce');
    return $order_statuses;
});

/**
 * Retrieve the configured persistent cart / internal API AUTH_KEY.
 *
 * @return string
 */
if (!function_exists('myapp_get_returns_auth_key')) {
    function myapp_get_returns_auth_key() {
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
 * Validate internal API request auth key.
 *
 * @param WP_REST_Request $request
 * @return bool
 */
if (!function_exists('myapp_validate_returns_internal_auth')) {
    function myapp_validate_returns_internal_auth(WP_REST_Request $request) {
        $configured_key = myapp_get_returns_auth_key();
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
 * Get the Next.js internal app endpoint URL.
 *
 * @return string
 */
function myapp_get_nextjs_internal_base_url() {
    if (defined('MYAPP_NEXTJS_INTERNAL_URL') && is_string(MYAPP_NEXTJS_INTERNAL_URL) && MYAPP_NEXTJS_INTERNAL_URL !== '') {
        return rtrim(MYAPP_NEXTJS_INTERNAL_URL, '/');
    }
    $env_url = getenv('MYAPP_NEXTJS_INTERNAL_URL');
    if ($env_url !== false && is_string($env_url) && $env_url !== '') {
        return rtrim($env_url, '/');
    }
    if (defined('MYAPP_STOREFRONT_URL') && is_string(MYAPP_STOREFRONT_URL) && MYAPP_STOREFRONT_URL !== '') {
        return rtrim(MYAPP_STOREFRONT_URL, '/');
    }
    if (defined('NEXT_PUBLIC_SITE_URL') && is_string(NEXT_PUBLIC_SITE_URL) && NEXT_PUBLIC_SITE_URL !== '') {
        return rtrim(NEXT_PUBLIC_SITE_URL, '/');
    }
    return 'http://localhost:3000';
}

/**
 * Calculate expected refund amount for a return request.
 *
 * @param WC_Order $order
 * @param string $reason
 * @return float
 */
function myapp_calculate_return_refund_amount(WC_Order $order, $reason) {
    $order_total     = (float) $order->get_total();
    $shipping_total  = (float) $order->get_shipping_total();
    $already_refunded = (float) $order->get_total_refunded();

    $full_refund_reasons = ['damaged', 'defective', 'wrong_item'];

    if (in_array($reason, $full_refund_reasons, true)) {
        $eligible = $order_total;
    } else {
        // Exclude shipping total for changed_mind and other
        $eligible = max(0, $order_total - $shipping_total);
    }

    $final_amount = max(0, $eligible - $already_refunded);
    return round($final_amount, 2);
}

/**
 * REST Callback: Handle customer return request.
 * POST /wp-json/myapp/v1/orders/(?P<order_id>\d+)/return
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response
 */
function myapp_handle_customer_return_request(WP_REST_Request $request) {
    if (!myapp_validate_returns_internal_auth($request)) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Unauthorized: Invalid or missing internal auth key.',
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

    $order_customer_id   = (int) $order->get_customer_id();
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
            'message' => 'You do not have permission to request a return for this order.',
        ], 403);
    }

    $raw_status = strtolower(str_replace('wc-', '', (string) $order->get_status()));
    if ($raw_status !== 'completed') {
        return new WP_REST_Response([
            'success' => false,
            'error'   => 'invalid_status',
            'message' => 'Returns can only be requested on delivered/completed orders.',
        ], 400);
    }

    // Check duplicate return request
    $existing_return = $order->get_meta('_myapp_return_request');
    if (!empty($existing_return) || strpos($raw_status, 'return-') === 0) {
        return new WP_REST_Response([
            'success' => false,
            'error'   => 'already_requested',
            'message' => 'A return request has already been submitted for this order.',
        ], 400);
    }

    // Check delivery return window (default 7 days)
    $window_days = (int) (defined('MYAPP_RETURN_WINDOW_DAYS') ? MYAPP_RETURN_WINDOW_DAYS : 7);
    $delivered_at_str = (string) $order->get_meta('_myapp_delivered_at');

    if (empty($delivered_at_str)) {
        $date_completed = $order->get_date_completed();
        if ($date_completed instanceof WC_DateTime) {
            $delivered_at_str = $date_completed->date('c');
        }
    }

    if (!empty($delivered_at_str)) {
        $delivered_timestamp = strtotime($delivered_at_str);
        if ($delivered_timestamp !== false) {
            $window_seconds = $window_days * 86400;
            if ((time() - $delivered_timestamp) > $window_seconds) {
                return new WP_REST_Response([
                    'success' => false,
                    'error'   => 'window_expired',
                    'message' => sprintf('The return window (%d days from delivery) for this order has expired.', $window_days),
                ], 400);
            }
        }
    }

    // Parse input body
    $raw_body = $request->get_body();
    $body = json_decode($raw_body, true);
    if (!is_array($body)) {
        return new WP_REST_Response([
            'success' => false,
            'error'   => 'invalid_body',
            'message' => 'Invalid JSON request body.',
        ], 400);
    }

    $reason         = sanitize_text_field((string) ($body['reason'] ?? 'other'));
    $note           = sanitize_textarea_field((string) ($body['note'] ?? ''));
    $items          = isset($body['items']) && is_array($body['items']) ? $body['items'] : [];
    $photo_urls     = isset($body['photo_urls']) && is_array($body['photo_urls']) ? array_map('esc_url_raw', $body['photo_urls']) : [];
    $refund_account = null;
    if (isset($body['refund_account']) && is_array($body['refund_account'])) {
        $raw_ra = $body['refund_account'];
        $type_val = sanitize_text_field((string) ($raw_ra['type'] ?? ''));
        $upi_val  = sanitize_text_field((string) ($raw_ra['upi_id'] ?? $raw_ra['upiId'] ?? ''));
        $acc_val  = sanitize_text_field((string) ($raw_ra['account_number'] ?? $raw_ra['accountNumber'] ?? ''));
        $ifsc_val = sanitize_text_field((string) ($raw_ra['ifsc'] ?? $raw_ra['ifscCode'] ?? ''));
        $name_val = sanitize_text_field((string) ($raw_ra['holder_name'] ?? $raw_ra['holderName'] ?? $raw_ra['accountHolder'] ?? ''));

        $refund_account = [
            'type'           => $type_val ?: (!empty($upi_val) ? 'upi' : (!empty($acc_val) ? 'bank' : '')),
            'upi_id'         => $upi_val,
            'upiId'          => $upi_val,
            'account_number' => $acc_val,
            'accountNumber'  => $acc_val,
            'ifsc'           => $ifsc_val,
            'ifscCode'       => $ifsc_val,
            'holder_name'    => $name_val,
            'holderName'     => $name_val,
            'accountHolder'  => $name_val,
        ];
    }

    // Validate line item quantities
    $order_line_items = $order->get_items();
    $line_item_map = [];
    foreach ($order_line_items as $item_id => $item) {
        $line_item_map[(int)$item_id] = (int) $item->get_quantity();
    }

    $sanitized_items = [];
    foreach ($items as $item) {
        if (!is_array($item)) continue;
        $item_id = intval($item['id'] ?? ($item['item_id'] ?? 0));
        $qty     = intval($item['quantity'] ?? 0);

        if ($item_id <= 0 || $qty <= 0) continue;
        $max_qty = $line_item_map[$item_id] ?? 0;
        if ($qty > $max_qty) {
            return new WP_REST_Response([
                'success' => false,
                'error'   => 'invalid_quantity',
                'message' => sprintf('Requested return quantity (%d) exceeds ordered quantity (%d) for line item %d.', $qty, $max_qty, $item_id),
            ], 400);
        }

        $sanitized_items[] = [
            'id'       => $item_id,
            'quantity' => $qty,
        ];
    }

    // Require photo URLs for damaged / defective / wrong_item
    $requires_photos = in_array($reason, ['damaged', 'defective', 'wrong_item'], true);
    if ($requires_photos && empty($photo_urls)) {
        return new WP_REST_Response([
            'success' => false,
            'error'   => 'photos_required',
            'message' => 'At least one photo is required for damaged, defective, or wrong item return requests.',
        ], 400);
    }

    // Compute refund amount
    $refund_amount = myapp_calculate_return_refund_amount($order, $reason);

    $return_payload = [
        'reason'         => $reason,
        'note'           => $note,
        'items'          => $sanitized_items,
        'photo_urls'     => $photo_urls,
        'refund_account' => $refund_account,
        'refund_amount'  => $refund_amount,
    ];

    $order->update_meta_data('_myapp_return_request', wp_json_encode($return_payload));
    $order->update_meta_data('_myapp_return_requested_at', gmdate('c'));
    $order->update_meta_data('_myapp_return_refund_amount', $refund_amount);

    $refund_desc = '';
    if (!empty($refund_account) && is_array($refund_account)) {
        if (!empty($refund_account['upi_id'])) {
            $refund_desc = ' [COD UPI: ' . $refund_account['upi_id'] . ']';
        } elseif (!empty($refund_account['account_number'])) {
            $refund_desc = sprintf(' [COD Bank: A/C %s, IFSC %s, %s]', $refund_account['account_number'], $refund_account['ifsc'], $refund_account['holder_name']);
        }
    }

    $order->update_status('return-requested', sprintf('Customer return requested (%s): %s%s', $reason, $note ?: 'No note', $refund_desc));
    $order->save();

    // Send notification email to site admin
    $admin_email = get_option('admin_email');
    if (!empty($admin_email)) {
        $subject = sprintf('[%s] Return Requested for Order #%s', get_bloginfo('name'), $order->get_order_number());
        $refund_email_line = '';
        if (!empty($refund_account['upi_id'])) {
            $refund_email_line = "\nCOD Refund: UPI ID " . $refund_account['upi_id'];
        } elseif (!empty($refund_account['account_number'])) {
            $refund_email_line = sprintf("\nCOD Refund Account:\n- Account: %s\n- IFSC: %s\n- Holder: %s", $refund_account['account_number'], $refund_account['ifsc'], $refund_account['holder_name']);
        }
        $message = sprintf(
            "Hello Admin,\n\nA return request has been submitted for Order #%s.\n\nReason: %s\nNote: %s\nEstimated Refund Amount: %s%s\n\nPlease review and approve/reject in WooCommerce Admin:\n%s\n",
            $order->get_order_number(),
            $reason,
            $note ?: 'None',
            wc_price($refund_amount),
            $refund_email_line,
            admin_url('post.php?post=' . $order->get_id() . '&action=edit')
        );
        wp_mail($admin_email, $subject, $message);
    }

    return new WP_REST_Response([
        'success'       => true,
        'order_id'      => $order->get_id(),
        'status'        => 'return-requested',
        'refund_amount' => $refund_amount,
        'message'       => 'Return request submitted successfully. Our team will review it shortly.',
    ], 200);
}

/**
 * Handle Order Status Change to return-received: Trigger automated Next.js refund webhook.
 */
add_action('woocommerce_order_status_return-received', function ($order_id) {
    $order = wc_get_order($order_id);
    if (!$order instanceof WC_Order) return;

    // Trigger internal Next.js refund endpoint
    $auth_key = myapp_get_returns_auth_key();
    $next_url = myapp_get_nextjs_internal_base_url() . '/api/internal/refund';

    $refund_amount = (float) $order->get_meta('_myapp_return_refund_amount');
    if ($refund_amount <= 0) {
        $return_meta = $order->get_meta('_myapp_return_request');
        if (!empty($return_meta)) {
            $decoded = json_decode($return_meta, true);
            $refund_amount = (float) ($decoded['refund_amount'] ?? 0);
        }
    }
    if ($refund_amount <= 0) {
        $refund_amount = (float) $order->get_total();
    }

    $response = wp_remote_post($next_url, [
        'headers'     => [
            'Content-Type' => 'application/json',
            'x-auth-key'   => $auth_key,
        ],
        'body'        => wp_json_encode([
            'orderId' => $order_id,
            'amount'  => $refund_amount,
            'reason'  => 'Return received',
        ]),
        'timeout'     => 15,
        'blocking'    => true,
    ]);

    if (is_wp_error($response)) {
        error_log('[Return Received Webhook] Failed to trigger Next.js internal refund: ' . $response->get_error_message());
        $order->add_order_note('Internal refund trigger failed: ' . $response->get_error_message());
    } else {
        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        error_log(sprintf('[Return Received Webhook] Next.js refund response (%d): %s', $code, $body));
    }
});

/**
 * Handle Order Status Change to return-rejected: Send email with rejection note to customer.
 */
add_action('woocommerce_order_status_return-rejected', function ($order_id) {
    $order = wc_get_order($order_id);
    if (!$order instanceof WC_Order) return;

    $customer_email = $order->get_billing_email();
    if (empty($customer_email)) return;

    $rejection_note = (string) $order->get_meta('_myapp_return_rejection_note');
    $subject = sprintf('[%s] Update regarding your return request for Order #%s', get_bloginfo('name'), $order->get_order_number());
    $message = sprintf(
        "Dear %s,\n\nYour return request for Order #%s has been rejected.\n\nReason/Note: %s\n\nIf you have any questions, please contact our support team.\n\nThank you,\n%s Team",
        $order->get_billing_first_name() ?: 'Customer',
        $order->get_order_number(),
        $rejection_note ?: 'Does not meet our return policy conditions.',
        get_bloginfo('name')
    );

    wp_mail($customer_email, $subject, $message);
});

/**
 * Register Admin Meta Box for Returns
 */
add_action('add_meta_boxes', function () {
    $screens = ['shop_order', 'woocommerce_page_wc-orders'];
    foreach ($screens as $screen) {
        add_meta_box(
            'myapp_order_return_meta_box',
            __('Customer Return Request', 'woocommerce'),
            'myapp_render_order_return_meta_box',
            $screen,
            'side',
            'high'
        );
    }
});

function myapp_render_order_return_meta_box($post_or_order) {
    $order = $post_or_order instanceof WC_Order ? $post_or_order : wc_get_order($post_or_order->ID);
    if (!$order instanceof WC_Order) return;

    $return_json = $order->get_meta('_myapp_return_request');
    if (empty($return_json)) {
        echo '<p style="color:#666;">' . esc_html__('No return request submitted for this order.', 'woocommerce') . '</p>';
        return;
    }

    $data = json_decode($return_json, true);
    $refund_amount = (float) $order->get_meta('_myapp_return_refund_amount');
    if ($refund_amount <= 0) {
        $refund_amount = (float) ($data['refund_amount'] ?? 0);
    }
    $requested_at = $order->get_meta('_myapp_return_requested_at');

    wp_nonce_field('myapp_save_return_meta', 'myapp_return_meta_nonce');

    echo '<div style="font-size:13px;line-height:1.5;">';
    echo '<p><strong>' . esc_html__('Reason:', 'woocommerce') . '</strong> ' . esc_html($data['reason'] ?? 'N/A') . '</p>';
    if (!empty($data['note'])) {
        echo '<p><strong>' . esc_html__('Customer Note:', 'woocommerce') . '</strong> ' . esc_html($data['note']) . '</p>';
    }
    if (!empty($requested_at)) {
        echo '<p><strong>' . esc_html__('Requested At:', 'woocommerce') . '</strong> ' . esc_html($requested_at) . '</p>';
    }

    // Photos
    if (!empty($data['photo_urls']) && is_array($data['photo_urls'])) {
        echo '<p><strong>' . esc_html__('Photos:', 'woocommerce') . '</strong></p><div style="display:flex;gap:6px;flex-wrap:wrap;">';
        foreach ($data['photo_urls'] as $url) {
            echo '<a href="' . esc_url($url) . '" target="_blank" rel="noopener"><img src="' . esc_url($url) . '" style="width:50px;height:50px;object-fit:cover;border-radius:4px;border:1px solid #ccc;" /></a>';
        }
        echo '</div>';
    }

    // COD refund details
    if (!empty($data['refund_account']) && is_array($data['refund_account'])) {
        $ra = $data['refund_account'];
        $upi_id = !empty($ra['upi_id']) ? $ra['upi_id'] : (!empty($ra['upiId']) ? $ra['upiId'] : '');
        $account_number = !empty($ra['account_number']) ? $ra['account_number'] : (!empty($ra['accountNumber']) ? $ra['accountNumber'] : '');
        $ifsc = !empty($ra['ifsc']) ? $ra['ifsc'] : (!empty($ra['ifscCode']) ? $ra['ifscCode'] : '');
        $holder_name = !empty($ra['holder_name']) ? $ra['holder_name'] : (!empty($ra['holderName']) ? $ra['holderName'] : (!empty($ra['accountHolder']) ? $ra['accountHolder'] : ''));
        $type = !empty($ra['type']) ? strtoupper($ra['type']) : (!empty($upi_id) ? 'UPI' : (!empty($account_number) ? 'BANK' : ''));

        echo '<div style="margin-top:10px;padding:10px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;">';
        echo '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">';
        echo '<strong style="color:#0f172a;font-size:12px;">' . esc_html__('COD Refund Account:', 'woocommerce') . '</strong>';
        if (!empty($type)) {
            echo '<span style="font-size:10px;background:#e2e8f0;color:#334155;padding:2px 6px;border-radius:4px;font-weight:700;">' . esc_html($type) . '</span>';
        }
        echo '</div>';
        echo '<div style="font-size:12px;line-height:1.6;color:#334155;">';
        if (!empty($upi_id)) {
            echo '<strong>' . esc_html__('UPI ID:', 'woocommerce') . '</strong> ' . esc_html($upi_id) . '<br>';
        }
        if (!empty($account_number)) {
            echo '<strong>' . esc_html__('Account No:', 'woocommerce') . '</strong> ' . esc_html($account_number) . '<br>';
            if (!empty($ifsc)) {
                echo '<strong>' . esc_html__('IFSC Code:', 'woocommerce') . '</strong> ' . esc_html($ifsc) . '<br>';
            }
            if (!empty($holder_name)) {
                echo '<strong>' . esc_html__('Holder Name:', 'woocommerce') . '</strong> ' . esc_html($holder_name) . '<br>';
            }
        }
        if (empty($upi_id) && empty($account_number)) {
            echo '<em style="color:#64748b;">' . esc_html__('No account details found.', 'woocommerce') . '</em>';
        }
        echo '</div>';
        echo '</div>';
    }

    // Editable refund amount
    echo '<div style="margin-top:12px;">';
    echo '<label for="myapp_return_refund_amount"><strong>' . esc_html__('Approved Refund Amount (₹):', 'woocommerce') . '</strong></label><br>';
    echo '<input type="number" step="0.01" min="0" name="myapp_return_refund_amount" id="myapp_return_refund_amount" value="' . esc_attr($refund_amount) . '" style="width:100%;margin-top:4px;" />';
    echo '</div>';

    // Rejection note
    $rejection_note = (string) $order->get_meta('_myapp_return_rejection_note');
    echo '<div style="margin-top:10px;">';
    echo '<label for="myapp_return_rejection_note"><strong>' . esc_html__('Rejection Note (if rejecting):', 'woocommerce') . '</strong></label><br>';
    echo '<textarea name="myapp_return_rejection_note" id="myapp_return_rejection_note" rows="2" style="width:100%;margin-top:4px;" placeholder="' . esc_attr__('Reason emailed to customer on rejection...', 'woocommerce') . '">' . esc_textarea($rejection_note) . '</textarea>';
    echo '</div>';

    echo '</div>';
}

/**
 * Save custom return fields on order update in WP Admin.
 */
add_action('woocommerce_process_shop_order_meta', 'myapp_save_order_return_meta_fields');
function myapp_save_order_return_meta_fields($order_id) {
    if (!isset($_POST['myapp_return_meta_nonce']) || !wp_verify_nonce($_POST['myapp_return_meta_nonce'], 'myapp_save_return_meta')) {
        return;
    }

    $order = wc_get_order($order_id);
    if (!$order instanceof WC_Order) return;

    if (isset($_POST['myapp_return_refund_amount'])) {
        $amount = (float) sanitize_text_field($_POST['myapp_return_refund_amount']);
        $order->update_meta_data('_myapp_return_refund_amount', $amount);
    }

    if (isset($_POST['myapp_return_rejection_note'])) {
        $rej_note = sanitize_textarea_field($_POST['myapp_return_rejection_note']);
        $order->update_meta_data('_myapp_return_rejection_note', $rej_note);
    }

    $order->save();
}

/**
 * Register custom returns REST route.
 */
add_action('rest_api_init', function () {
    register_rest_route('myapp/v1', '/orders/(?P<order_id>\d+)/return', [
        'methods'             => 'POST',
        'callback'            => 'myapp_handle_customer_return_request',
        'permission_callback' => '__return_true',
    ]);
});
