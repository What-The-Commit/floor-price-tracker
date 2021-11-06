<?php

require_once __DIR__ . DIRECTORY_SEPARATOR . 'vendor/autoload.php';

use Twig\Loader\FilesystemLoader;
use Twig\Environment;

$loader = new FilesystemLoader(__DIR__ . DIRECTORY_SEPARATOR . 'templates');

$twig = new Environment($loader, [
    'cache' => __DIR__ . DIRECTORY_SEPARATOR . 'cache',
]);

echo $twig->render('index.html', []);