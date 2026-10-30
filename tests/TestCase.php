<?php

namespace Rllngr\KirbyVisibilizer\Tests;

use Kirby\Cms\App;
use Kirby\Filesystem\Dir;
use PHPUnit\Framework\TestCase as Base;

abstract class TestCase extends Base
{
    protected string $root;

    protected function setUp(): void
    {
        $this->root = sys_get_temp_dir() . '/visibilizer-tests-' . uniqid();
        Dir::make($this->root);
    }

    protected function tearDown(): void
    {
        Dir::remove($this->root);
        // Kirby installe ses gestionnaires d'erreurs à chaque instance
        if (App::instance(null, true)) {
            restore_error_handler();
            restore_exception_handler();
        }

        App::destroy();
    }

    protected function app(array $props = []): App
    {
        return new App(array_replace_recursive([
            'roots' => ['index' => $this->root],
            'urls'  => ['index' => 'https://kirby.test'],
            'options' => ['whoops' => false],
        ], $props));
    }
}
