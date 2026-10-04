<?php
/**
 * Customer new account email (Plain Text) - Headless Next.js Storefront Override
 */

defined('ABSPATH') || exit;

echo "=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n";
echo esc_html($email_heading) . "\n";
echo "=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n\n";

/* translators: %s: Customer username */
echo sprintf(esc_html__('Hi %s,', 'woocommerce'), esc_html($user_login)) . "\n\n";

$account_url = function_exists('myapp_storefront_url') ? myapp_storefront_url('account') : wc_get_page_permalink('myaccount');

/* translators: %1$s: Site title, %2$s: Username, %3$s: My account link */
echo sprintf(
    esc_html__('Thanks for creating an account on %1$s. Your username is %2$s. You can access your account area to view orders, change your password, and more at: %3$s', 'woocommerce'),
    esc_html($blogname),
    esc_html($user_login),
    esc_url($account_url)
) . "\n\n";

if ('yes' === get_option('woocommerce_registration_generate_password') && $password_generated && $set_password_url) {
    $storefront_reset_url = function_exists('myapp_storefront_url') ? myapp_storefront_url('reset_password') : '';
    $final_set_password_url = $storefront_reset_url ? add_query_arg(['key' => $reset_key, 'id' => $user_id], $storefront_reset_url) : $set_password_url;
    echo sprintf(esc_html__('Set your new password: %s', 'woocommerce'), esc_url($final_set_password_url)) . "\n\n";
}

echo "\n=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n\n";

echo apply_filters('woocommerce_email_footer_text', get_option('woocommerce_email_footer_text')); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
