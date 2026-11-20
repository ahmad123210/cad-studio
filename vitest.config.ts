import { defineConfig } from 'vitest/config';

// إعداد مستقل عن vite.config.ts (لا نحتاج إضافات React/Tailwind لاختبارات الوحدات)
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/unit/setup.ts'],
  },
});
