<?php
/**
 * Plugin Name: MyApp Saved Address Book Endpoint
 * Description: Custom REST API endpoints to manage customer saved addresses backed by WordPress user meta and synchronized with WooCommerce shipping fields.
 * Version: 1.0.0
 * Author: Siva
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Retrieve the configured persistent cart / internal API AUTH_KEY.
 *
 * @return string
 */
if (!function_exists('myapp_get_address_book_auth_key')) {
    function myapp_get_address_book_auth_key() {
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
 * Validate internal API request auth key against configured secret using constant-time comparison.
 * Accepts key via 'x-auth-key' header, 'AUTH_KEY' parameter, or 'Bearer <token>' Authorization header.
 *
 * @param WP_REST_Request $request
 * @return bool
 */
if (!function_exists('myapp_validate_address_book_auth')) {
    function myapp_validate_address_book_auth(WP_REST_Request $request) {
        $configured_key = myapp_get_address_book_auth_key();
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
 * Helper to get and validate user_id from request.
 *
 * @param WP_REST_Request $request
 * @return int|WP_Error
 */
function myapp_address_book_get_valid_user(WP_REST_Request $request) {
    $user_id = $request->get_param('user_id');
    if (empty($user_id) || !is_numeric($user_id)) {
        return new WP_Error('invalid_user', 'Missing or invalid user_id.', ['status' => 400]);
    }

    $user_id = (int) $user_id;
    $user = get_userdata($user_id);
    if (!$user) {
        return new WP_Error('user_not_found', 'User not found.', ['status' => 404]);
    }

    return $user_id;
}

/**
 * Retrieve saved address book from user meta.
 *
 * @param int $user_id
 * @return array
 */
function myapp_get_user_address_book($user_id) {
    $addresses = get_user_meta($user_id, '_myapp_address_book', true);
    if (!is_array($addresses)) {
        return [];
    }
    return array_values($addresses);
}

/**
 * Save user address book to user meta.
 *
 * @param int $user_id
 * @param array $addresses
 * @return bool
 */
function myapp_save_user_address_book($user_id, array $addresses) {
    return update_user_meta($user_id, '_myapp_address_book', array_values($addresses));
}

/**
 * Sync default address with WooCommerce customer native shipping fields.
 *
 * @param int $user_id
 * @param array|null $default_address
 */
function myapp_sync_default_to_wc_shipping($user_id, $default_address) {
    if (!class_exists('WC_Customer')) {
        return;
    }

    try {
        $customer = new WC_Customer($user_id);
        if (!$customer || !$customer->get_id()) {
            return;
        }

        if ($default_address) {
            $customer->set_shipping_first_name($default_address['first_name'] ?? '');
            $customer->set_shipping_last_name($default_address['last_name'] ?? '');
            $customer->set_shipping_company($default_address['company'] ?? '');
            $customer->set_shipping_address_1($default_address['address_1'] ?? '');
            $customer->set_shipping_address_2($default_address['address_2'] ?? '');
            $customer->set_shipping_city($default_address['city'] ?? '');
            $customer->set_shipping_state($default_address['state'] ?? '');
            $customer->set_shipping_postcode($default_address['postcode'] ?? '');
            $customer->set_shipping_country($default_address['country'] ?? '');

            $phone = $default_address['phone'] ?? '';
            if (method_exists($customer, 'set_shipping_phone')) {
                $customer->set_shipping_phone($phone);
            } else {
                update_user_meta($user_id, 'shipping_phone', $phone);
            }
        }

        $customer->save();
    } catch (\Throwable $e) {
        error_log('[myapp_sync_default_to_wc_shipping] Error syncing shipping address: ' . $e->getMessage());
    }
}

/**
 * Build virtual default address from existing WooCommerce customer shipping fields.
 *
 * @param int $user_id
 * @return array|null
 */
function myapp_get_virtual_default_address($user_id) {
    if (!class_exists('WC_Customer')) {
        $address_1 = get_user_meta($user_id, 'shipping_address_1', true);
        if (empty($address_1)) {
            return null;
        }
        return [
            'id'         => 'default-native',
            'label'      => 'Default Shipping',
            'first_name' => (string) get_user_meta($user_id, 'shipping_first_name', true),
            'last_name'  => (string) get_user_meta($user_id, 'shipping_last_name', true),
            'company'    => (string) get_user_meta($user_id, 'shipping_company', true),
            'phone'      => (string) get_user_meta($user_id, 'shipping_phone', true),
            'address_1'  => (string) $address_1,
            'address_2'  => (string) get_user_meta($user_id, 'shipping_address_2', true),
            'city'       => (string) get_user_meta($user_id, 'shipping_city', true),
            'state'      => (string) get_user_meta($user_id, 'shipping_state', true),
            'postcode'   => (string) get_user_meta($user_id, 'shipping_postcode', true),
            'country'    => (string) get_user_meta($user_id, 'shipping_country', true),
            'is_default' => true,
            'created_at' => gmdate('c'),
            'updated_at' => gmdate('c'),
        ];
    }

    try {
        $customer = new WC_Customer($user_id);
        $address_1 = $customer->get_shipping_address_1();
        if (empty($address_1)) {
            return null;
        }

        $phone = method_exists($customer, 'get_shipping_phone')
            ? $customer->get_shipping_phone()
            : (string) get_user_meta($user_id, 'shipping_phone', true);

        return [
            'id'         => 'default-native',
            'label'      => 'Default Shipping',
            'first_name' => (string) $customer->get_shipping_first_name(),
            'last_name'  => (string) $customer->get_shipping_last_name(),
            'company'    => (string) $customer->get_shipping_company(),
            'phone'      => (string) $phone,
            'address_1'  => (string) $address_1,
            'address_2'  => (string) $customer->get_shipping_address_2(),
            'city'       => (string) $customer->get_shipping_city(),
            'state'      => (string) $customer->get_shipping_state(),
            'postcode'   => (string) $customer->get_shipping_postcode(),
            'country'    => (string) $customer->get_shipping_country(),
            'is_default' => true,
            'created_at' => gmdate('c'),
            'updated_at' => gmdate('c'),
        ];
    } catch (\Throwable $e) {
        return null;
    }
}

/**
 * Validate and sanitize address fields.
 *
 * @param array $input
 * @return array|WP_Error Sanitized array or WP_Error with field-level issues
 */
function myapp_validate_and_sanitize_address(array $input) {
    $errors = [];

    $sanitized = [
        'label'      => isset($input['label']) ? sanitize_text_field($input['label']) : 'Home',
        'first_name' => isset($input['first_name']) ? sanitize_text_field($input['first_name']) : '',
        'last_name'  => isset($input['last_name']) ? sanitize_text_field($input['last_name']) : '',
        'company'    => isset($input['company']) ? sanitize_text_field($input['company']) : '',
        'phone'      => isset($input['phone']) ? sanitize_text_field($input['phone']) : '',
        'address_1'  => isset($input['address_1']) ? sanitize_text_field($input['address_1']) : '',
        'address_2'  => isset($input['address_2']) ? sanitize_text_field($input['address_2']) : '',
        'city'       => isset($input['city']) ? sanitize_text_field($input['city']) : '',
        'state'      => isset($input['state']) ? sanitize_text_field($input['state']) : '',
        'postcode'   => isset($input['postcode']) ? sanitize_text_field($input['postcode']) : '',
        'country'    => isset($input['country']) ? strtoupper(sanitize_text_field($input['country'])) : '',
        'is_default' => !empty($input['is_default']),
    ];

    if ($sanitized['label'] === '') {
        $sanitized['label'] = 'Home';
    }

    if (empty($sanitized['first_name'])) {
        $errors['first_name'] = 'First name is required.';
    }
    if (empty($sanitized['last_name'])) {
        $errors['last_name'] = 'Last name is required.';
    }
    if (empty($sanitized['address_1'])) {
        $errors['address_1'] = 'Address is required.';
    }
    if (empty($sanitized['city'])) {
        $errors['city'] = 'City is required.';
    }
    if (empty($sanitized['country'])) {
        $errors['country'] = 'Country is required.';
    }
    if (empty($sanitized['postcode'])) {
        $errors['postcode'] = 'Postcode is required.';
    }

    // WooCommerce Validation Checks
    if (function_exists('WC') && WC() && WC()->countries) {
        $countries = WC()->countries->get_countries();
        if (!empty($sanitized['country']) && !isset($countries[$sanitized['country']])) {
            $errors['country'] = 'Invalid country code.';
        } else if (!empty($sanitized['country']) && !empty($sanitized['state'])) {
            $states = WC()->countries->get_states($sanitized['country']);
            if (is_array($states) && !empty($states) && !isset($states[$sanitized['state']])) {
                $errors['state'] = 'Invalid state for the selected country.';
            }
        }
    }

    if (!empty($sanitized['postcode']) && !empty($sanitized['country']) && class_exists('WC_Validation')) {
        if (!WC_Validation::is_postcode($sanitized['postcode'], $sanitized['country'])) {
            $errors['postcode'] = 'Invalid postcode format for the selected country.';
        }
    }

    if (!empty($sanitized['phone']) && class_exists('WC_Validation')) {
        if (!WC_Validation::is_phone($sanitized['phone'])) {
            $errors['phone'] = 'Invalid phone number format.';
        }
    }

    if (!empty($errors)) {
        return new WP_Error('validation_error', 'Invalid address data.', [
            'status' => 400,
            'errors' => $errors,
        ]);
    }

    return $sanitized;
}

/**
 * Find default address ID from address list.
 *
 * @param array $addresses
 * @return string|null
 */
function myapp_get_default_address_id(array $addresses) {
    foreach ($addresses as $addr) {
        if (!empty($addr['is_default'])) {
            return $addr['id'];
        }
    }
    return !empty($addresses) ? $addresses[0]['id'] : null;
}

/**
 * Format response payload.
 *
 * @param array $addresses
 * @return array
 */
function myapp_format_address_book_response(array $addresses) {
    $default_id = myapp_get_default_address_id($addresses);
    return [
        'addresses'  => $addresses,
        'default_id' => $default_id,
    ];
}

/**
 * Register REST API Routes.
 */
add_action('rest_api_init', function () {
    $namespace = 'myapp/v1';

    // GET /addresses
    register_rest_route($namespace, '/addresses', [
        'methods'             => WP_REST_Server::READABLE,
        'permission_callback' => 'myapp_validate_address_book_auth',
        'callback'            => function (WP_REST_Request $request) {
            $user_id = myapp_address_book_get_valid_user($request);
            if (is_wp_error($user_id)) {
                return $user_id;
            }

            $addresses = myapp_get_user_address_book($user_id);
            if (empty($addresses)) {
                $virtual = myapp_get_virtual_default_address($user_id);
                if ($virtual) {
                    $addresses = [$virtual];
                }
            }

            return new WP_REST_Response(myapp_format_address_book_response($addresses), 200);
        },
    ]);

    // POST /addresses
    register_rest_route($namespace, '/addresses', [
        'methods'             => WP_REST_Server::CREATABLE,
        'permission_callback' => 'myapp_validate_address_book_auth',
        'callback'            => function (WP_REST_Request $request) {
            $user_id = myapp_address_book_get_valid_user($request);
            if (is_wp_error($user_id)) {
                return $user_id;
            }

            $params = $request->get_json_params();
            if (!is_array($params)) {
                $params = $request->get_params();
            }

            $sanitized = myapp_validate_and_sanitize_address($params);
            if (is_wp_error($sanitized)) {
                return $sanitized;
            }

            $addresses = myapp_get_user_address_book($user_id);

            // Check duplicate (same address_1, postcode, city, country, first and last name)
            $existing_index = -1;
            foreach ($addresses as $i => $addr) {
                if (
                    strcasecmp(trim($addr['first_name']), trim($sanitized['first_name'])) === 0 &&
                    strcasecmp(trim($addr['last_name']), trim($sanitized['last_name'])) === 0 &&
                    strcasecmp(trim($addr['address_1']), trim($sanitized['address_1'])) === 0 &&
                    strcasecmp(trim($addr['city']), trim($sanitized['city'])) === 0 &&
                    strcasecmp(trim($addr['postcode']), trim($sanitized['postcode'])) === 0 &&
                    strcasecmp(trim($addr['country']), trim($sanitized['country'])) === 0
                ) {
                    $existing_index = $i;
                    break;
                }
            }

            $now = gmdate('c');

            if ($existing_index >= 0) {
                // Update existing duplicate entry
                $target_id = $addresses[$existing_index]['id'];
                $is_default = $sanitized['is_default'] || !empty($addresses[$existing_index]['is_default']);

                $addresses[$existing_index] = array_merge($addresses[$existing_index], $sanitized, [
                    'id'         => $target_id,
                    'is_default' => $is_default,
                    'updated_at' => $now,
                ]);

                if ($is_default) {
                    foreach ($addresses as $i => &$addr) {
                        if ($i !== $existing_index) {
                            $addr['is_default'] = false;
                        }
                    }
                    unset($addr);
                    myapp_sync_default_to_wc_shipping($user_id, $addresses[$existing_index]);
                }

                myapp_save_user_address_book($user_id, $addresses);
                return new WP_REST_Response(myapp_format_address_book_response($addresses), 200);
            }

            // Max 10 limit check for new entries
            if (count($addresses) >= 10) {
                return new WP_Error(
                    'address_limit_exceeded',
                    'Maximum 10 addresses allowed per user.',
                    ['status' => 409]
                );
            }

            $new_id = wp_generate_uuid4();
            $is_first = empty($addresses);
            $is_default = $is_first || !empty($sanitized['is_default']);

            $new_address = array_merge($sanitized, [
                'id'         => $new_id,
                'is_default' => $is_default,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            if ($is_default) {
                foreach ($addresses as &$addr) {
                    $addr['is_default'] = false;
                }
                unset($addr);
                myapp_sync_default_to_wc_shipping($user_id, $new_address);
            }

            $addresses[] = $new_address;
            myapp_save_user_address_book($user_id, $addresses);

            return new WP_REST_Response(myapp_format_address_book_response($addresses), 201);
        },
    ]);

    // PUT /addresses/(?P<id>[a-f0-9-]+)
    register_rest_route($namespace, '/addresses/(?P<id>[a-f0-9-]+)', [
        'methods'             => WP_REST_Server::EDITABLE,
        'permission_callback' => 'myapp_validate_address_book_auth',
        'callback'            => function (WP_REST_Request $request) {
            $user_id = myapp_address_book_get_valid_user($request);
            if (is_wp_error($user_id)) {
                return $user_id;
            }

            $id = $request->get_param('id');
            $params = $request->get_json_params();
            if (!is_array($params)) {
                $params = $request->get_params();
            }

            $addresses = myapp_get_user_address_book($user_id);
            $target_index = -1;
            foreach ($addresses as $i => $addr) {
                if ($addr['id'] === $id) {
                    $target_index = $i;
                    break;
                }
            }

            if ($target_index === -1) {
                return new WP_Error('address_not_found', 'Address not found.', ['status' => 404]);
            }

            $merged_params = array_merge($addresses[$target_index], $params);
            $sanitized = myapp_validate_and_sanitize_address($merged_params);
            if (is_wp_error($sanitized)) {
                return $sanitized;
            }

            $now = gmdate('c');
            $was_default = !empty($addresses[$target_index]['is_default']);
            $is_default = !empty($sanitized['is_default']) || $was_default;

            $addresses[$target_index] = array_merge($addresses[$target_index], $sanitized, [
                'id'         => $id,
                'is_default' => $is_default,
                'updated_at' => $now,
            ]);

            if ($is_default) {
                foreach ($addresses as $i => &$addr) {
                    if ($i !== $target_index) {
                        $addr['is_default'] = false;
                    }
                }
                unset($addr);
                myapp_sync_default_to_wc_shipping($user_id, $addresses[$target_index]);
            }

            myapp_save_user_address_book($user_id, $addresses);
            return new WP_REST_Response(myapp_format_address_book_response($addresses), 200);
        },
    ]);

    // DELETE /addresses/(?P<id>[a-f0-9-]+)
    register_rest_route($namespace, '/addresses/(?P<id>[a-f0-9-]+)', [
        'methods'             => WP_REST_Server::DELETABLE,
        'permission_callback' => 'myapp_validate_address_book_auth',
        'callback'            => function (WP_REST_Request $request) {
            $user_id = myapp_address_book_get_valid_user($request);
            if (is_wp_error($user_id)) {
                return $user_id;
            }

            $id = $request->get_param('id');
            $addresses = myapp_get_user_address_book($user_id);
            $target_index = -1;
            foreach ($addresses as $i => $addr) {
                if ($addr['id'] === $id) {
                    $target_index = $i;
                    break;
                }
            }

            if ($target_index === -1) {
                return new WP_Error('address_not_found', 'Address not found.', ['status' => 404]);
            }

            $was_default = !empty($addresses[$target_index]['is_default']);
            array_splice($addresses, $target_index, 1);

            if ($was_default && !empty($addresses)) {
                // Promote most recently updated address
                usort($addresses, function ($a, $b) {
                    $time_a = isset($a['updated_at']) ? strtotime($a['updated_at']) : 0;
                    $time_b = isset($b['updated_at']) ? strtotime($b['updated_at']) : 0;
                    return $time_b - $time_a;
                });
                $addresses[0]['is_default'] = true;
                foreach ($addresses as $i => &$addr) {
                    if ($i !== 0) {
                        $addr['is_default'] = false;
                    }
                }
                unset($addr);
                myapp_sync_default_to_wc_shipping($user_id, $addresses[0]);
            }

            myapp_save_user_address_book($user_id, $addresses);
            return new WP_REST_Response(myapp_format_address_book_response($addresses), 200);
        },
    ]);

    // POST /addresses/(?P<id>[a-f0-9-]+)/default
    register_rest_route($namespace, '/addresses/(?P<id>[a-f0-9-]+)/default', [
        'methods'             => WP_REST_Server::CREATABLE,
        'permission_callback' => 'myapp_validate_address_book_auth',
        'callback'            => function (WP_REST_Request $request) {
            $user_id = myapp_address_book_get_valid_user($request);
            if (is_wp_error($user_id)) {
                return $user_id;
            }

            $id = $request->get_param('id');
            $addresses = myapp_get_user_address_book($user_id);
            $target_index = -1;
            foreach ($addresses as $i => $addr) {
                if ($addr['id'] === $id) {
                    $target_index = $i;
                    break;
                }
            }

            if ($target_index === -1) {
                return new WP_Error('address_not_found', 'Address not found.', ['status' => 404]);
            }

            $now = gmdate('c');
            foreach ($addresses as $i => &$addr) {
                if ($i === $target_index) {
                    $addr['is_default'] = true;
                    $addr['updated_at'] = $now;
                } else {
                    $addr['is_default'] = false;
                }
            }
            unset($addr);

            myapp_sync_default_to_wc_shipping($user_id, $addresses[$target_index]);
            myapp_save_user_address_book($user_id, $addresses);

            return new WP_REST_Response(myapp_format_address_book_response($addresses), 200);
        },
    ]);
});
