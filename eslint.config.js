import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['node_modules/**', '.codegraph/**', 'dist/**', 'coverage/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/app/**', '**/modules/**', '**/persistence/**', 'react', 'react-dom', 'dexie'],
              message: 'core/ is pure: no app/, modules/, persistence/, React or storage imports.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/modules/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/app/**', '**/persistence/**', '**/modules/*/**'],
              message: 'modules may import core/ only; siblings talk through commands and events.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/ui/**/*.{ts,tsx}', 'src/routes/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#[0-9a-fA-F]{3,6}$/]',
          message: 'Raw hex colour found. Use a token from src/ui/tokens.css instead.'
        },
        {
          selector: 'Literal[value=/\\b\\d+(px|rem|em)\\b/]',
          message: 'Raw font size found. Use a token from src/ui/tokens.css instead.'
        },
        {
          selector: 'Literal[value=/box-shadow|text-shadow/]',
          message: 'Raw shadow found. Use the --quil-shadow-3 token from src/ui/tokens.css instead.'
        }
      ]
    }
  },
  {
    files: ['src/persistence/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/app/**', '**/modules/**', '**/persistence/*/**'],
              message: 'persistence imports core/ only.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off'
    }
  }
)
