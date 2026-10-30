<?php
/**
 * Plugin Name: BWC Budget Dashboard Production Deployer
 * Description: Deploys the approved compiled Budget Dashboard build to /budget-dashboard-fs/ when activated.
 * Version: 2026.10.30.1
 * Author: Business Web Creations
 */

if (!defined('ABSPATH')) {
    exit;
}

function bwc_budget_dashboard_deploy_build() {
    $source = plugin_dir_path(__FILE__) . 'dist';
    $target = trailingslashit(ABSPATH) . 'budget-dashboard-fs';

    if (!is_dir($source)) {
        wp_die('Budget Dashboard deployment failed: the compiled dist directory is missing.');
    }

    if (!is_dir($target) && !wp_mkdir_p($target)) {
        wp_die('Budget Dashboard deployment failed: the production directory could not be created.');
    }

    $files = array();
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($source, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );

    foreach ($iterator as $item) {
        $relative = ltrim(str_replace('\\', '/', substr($item->getPathname(), strlen($source))), '/');
        if ($item->isDir()) {
            $directory = $target . '/' . $relative;
            if (!is_dir($directory) && !wp_mkdir_p($directory)) {
                wp_die('Budget Dashboard deployment failed while creating: ' . esc_html($relative));
            }
            continue;
        }
        $files[$relative] = $item->getPathname();
    }

    // Publish index.html last so it never points to assets that have not finished copying.
    uksort($files, static function ($a, $b) {
        if ($a === 'index.html') {
            return 1;
        }
        if ($b === 'index.html') {
            return -1;
        }
        return strcmp($a, $b);
    });

    foreach ($files as $relative => $source_file) {
        $destination = $target . '/' . $relative;
        $destination_dir = dirname($destination);
        if (!is_dir($destination_dir) && !wp_mkdir_p($destination_dir)) {
            wp_die('Budget Dashboard deployment failed while creating: ' . esc_html($relative));
        }
        if (!copy($source_file, $destination)) {
            wp_die('Budget Dashboard deployment failed while copying: ' . esc_html($relative));
        }
    }

    update_option('bwc_budget_dashboard_last_deploy', array(
        'version' => '2026.10.30.1',
        'commit' => '6f05253e43caec2f1b693fe4d195c725bc5db471',
        'deployed_at' => current_time('mysql', true),
        'file_count' => count($files),
    ), false);

    wp_cache_flush();
}

register_activation_hook(__FILE__, 'bwc_budget_dashboard_deploy_build');

