<?php

namespace Rllngr\KirbyVisibilizer\Tests;

use Rllngr\KirbyVisibilizer\LlmGenerator;

class LlmGeneratorTest extends TestCase
{
    protected function llm(array $content): LlmGenerator
    {
        $app = $this->app([
            'options' => ['rllngr.kirby-visibilizer' => ['cache' => false]],
            'site'    => [
                'content' => ['title' => 'Studio'] + $content,
            ],
        ]);

        return new LlmGenerator($app);
    }

    public function testLlmsUsesTheShortDescription(): void
    {
        $llm = $this->llm([
            'llmsdescription'     => 'Résumé court.',
            'llmsdescriptionfull' => 'Présentation longue et détaillée.',
        ]);

        $this->assertStringContainsString('> Résumé court.', $llm->generate());
        $this->assertStringNotContainsString('longue et détaillée', $llm->generate());
    }

    public function testLlmsFullUsesTheDetailedDescription(): void
    {
        $llm = $this->llm([
            'llmsdescription'     => 'Résumé court.',
            'llmsdescriptionfull' => 'Présentation longue et détaillée.',
        ]);

        $this->assertStringContainsString('> Présentation longue et détaillée.', $llm->generate(full: true));
    }

    public function testLlmsFullFallsBackToTheShortDescription(): void
    {
        $llm = $this->llm([
            'llmsdescription' => 'Résumé court.',
        ]);

        $this->assertStringContainsString('> Résumé court.', $llm->generate(full: true));
    }

    public function testToArrayCarriesTheRightDescriptionPerVariant(): void
    {
        $llm = $this->llm([
            'llmsdescription'     => 'Résumé court.',
            'llmsdescriptionfull' => 'Présentation longue et détaillée.',
        ]);

        $this->assertSame('Résumé court.', $llm->toArray()['description']);
        $this->assertSame('Présentation longue et détaillée.', $llm->toArray(full: true)['description']);
    }
}
