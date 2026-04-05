<?php

$finder = (new PhpCsFixer\Finder())
    ->in(__DIR__)
    ->exclude('var')
    ->exclude('config/secrets')
;

return (new PhpCsFixer\Config())
    ->setRules([
        '@Symfony' => true,
        'fully_qualified_strict_types' => true,
        'global_namespace_import' => [
            'import_classes' => true,
            'import_constants' => false,
            'import_functions' => false,
        ],
        'no_unused_imports' => true,
        'trailing_comma_in_multiline' => [
#            'elements' => ['arrays', 'arguments', 'parameters'],
            'elements' => [],
            'after_heredoc' => false
        ],
        'concat_space' => ['spacing' => 'one'],
        'class_definition' => ['space_before_parenthesis' => true],
    ])
    ->setFinder($finder)
;
