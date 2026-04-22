import { defineConfig } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  {
    ignores: ['dist/**', 'coverage/**'],
  },
  {
    files: [
      'src/components/SaveEstimateDialog.tsx',
      'src/hooks/useCatalog.ts',
      'src/hooks/useConstructor.ts',
      'src/screens/AdminPage.tsx',
      'src/screens/EstimatesPage.tsx',
    ],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['src/PdfExport.tsx'],
    rules: {
      'jsx-a11y/alt-text': 'off',
    },
  },
]);
