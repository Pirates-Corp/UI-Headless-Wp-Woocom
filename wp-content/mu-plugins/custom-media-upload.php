<?php
/**
 * Plugin Name: MyApp Media Upload Endpoint
 * Description: Secure internal endpoint for uploading return photos via API with auth key.
 * Version: 1.0.0
 * Author: Siva
 */

if (!defined('ABSPATH')) {
    exit;
}

// Reuse auth helpers from custom-returns-endpoint.php if available
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
            if (!empty($auth_header) && stripos($auth_header, 'Bearer ') === 0) {
                $provided_key = trim(substr($auth_header, 7));
            } else {
                $provided_key = trim($auth_header);
            }
        }
        if (empty($provided_key) || !is_string($provided_key)) {
            return false;
        }
        return hash_equals($configured_key, $provided_key);
    }
}

add_action('rest_api_init', function () {
    register_rest_route('myapp/v1', '/media/upload', [
        'methods' => 'POST',
        'callback' => 'myapp_handle_media_upload',
        'permission_callback' => '__return_true', // We'll validate manually
    ]);
});

// Ensure PHP & WordPress allow uploads up to 10MB
@ini_set('upload_max_filesize', '10M');
@ini_set('post_max_size', '12M');
@ini_set('memory_limit', '256M');

add_filter('upload_size_limit', function ($size) {
    return max((int) $size, 10 * 1024 * 1024);
});

function myapp_handle_media_upload(WP_REST_Request $request) {
    // Validate auth key
    if (!myapp_validate_returns_internal_auth($request)) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Unauthorized: Invalid or missing internal auth key.',
        ], 401);
    }

    // Expect a file field named 'file'
    if (empty($_FILES['file'])) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'No file was received by the server.',
        ], 400);
    }

    // Check PHP upload errors
    if (isset($_FILES['file']['error']) && $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        $error_code = (int) $_FILES['file']['error'];
        $upload_errors = [
            UPLOAD_ERR_INI_SIZE   => 'The uploaded file exceeds the server upload_max_filesize directive.',
            UPLOAD_ERR_FORM_SIZE  => 'The uploaded file exceeds the MAX_FILE_SIZE directive in the form.',
            UPLOAD_ERR_PARTIAL    => 'The uploaded file was only partially uploaded.',
            UPLOAD_ERR_NO_FILE    => 'No file was uploaded.',
            UPLOAD_ERR_NO_TMP_DIR => 'Missing temporary folder on the server.',
            UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk.',
            UPLOAD_ERR_EXTENSION  => 'A PHP extension stopped the file upload.',
        ];
        $msg = $upload_errors[$error_code] ?? ('Upload error code: ' . $error_code);
        return new WP_REST_Response([
            'success' => false,
            'message' => $msg,
        ], 400);
    }

    // Ensure wp-admin includes needed for media handling
    if (!function_exists('media_handle_upload')) {
        require_once ABSPATH . 'wp-admin/includes/image.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';
    }

    // Use WordPress media handling
    $attachment_id = media_handle_upload('file', 0);
    if (is_wp_error($attachment_id)) {
        return new WP_REST_Response([
            'success' => false,
            'message' => $attachment_id->get_error_message(),
        ], 500);
    }

    $url = wp_get_attachment_url($attachment_id);
    if (!$url) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Failed to retrieve media URL.',
        ], 500);
    }

    return new WP_REST_Response([
        'success' => true,
        'source_url' => $url,
    ], 200);
}
