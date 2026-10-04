<?php
/**
 * Customer new account email (HTML) - Headless Next.js Storefront Override
 */

defined('ABSPATH') || exit;

do_action('woocommerce_email_header', $email_heading, $email); ?>

<?php /* translators: %s: Customer username */ ?>
<p><?php printf(esc_html__('Hi %s,', 'woocommerce'), esc_html($user_login)); ?></p>

<?php
$account_url = function_exists('myapp_storefront_url') ? myapp_storefront_url('account') : wc_get_page_permalink('myaccount');
?>

<p><?php printf(
    /* translators: %1$s: Site title, %2$s: Username, %3$s: My account link */
    esc_html__('Thanks for creating an account on %1$s. Your username is %2$s. You can access your account area to view orders, change your password, and more at: %3$s', 'woocommerce'),
    esc_html($blogname),
    '<strong>' . esc_html($user_login) . '</strong>',
    '<a href="' . esc_url($account_url) . '">' . esc_html($account_url) . '</a>'
); ?></p>

<?php if ('yes' === get_option('woocommerce_registration_generate_password') && $password_generated && $set_password_url) : ?>
    <?php
    $storefront_reset_url = function_exists('myapp_storefront_url') ? myapp_storefront_url('reset_password') : '';
    $final_set_password_url = $storefront_reset_url ? add_query_arg(['key' => $reset_key, 'id' => $user_id], $storefront_reset_url) : $set_password_url;
    ?>
    <p><a href="<?php echo esc_url($final_set_password_url); ?>"><?php printf(esc_html__('Click here to set your new password.', 'woocommerce')); ?></a></p>
<?php endif; ?>

<?php
do_action('woocommerce_email_footer', $email);
