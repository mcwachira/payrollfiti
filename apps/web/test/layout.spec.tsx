import { metadata, viewport } from '../app/layout';
import { describe, it, expect } from '@jest/globals';

describe('Root layout', () => {
  describe('metadata', () => {
    it('should be exported', () => {
      expect(metadata).toBeDefined();
    });

    it('should contain a `title` and `description`', () => {
      expect(metadata).toHaveProperty('title');
      expect(metadata).toHaveProperty('description');
    });

    it('links the PWA manifest and an apple-touch-icon', () => {
      expect(metadata.manifest).toBe('/manifest.webmanifest');
      expect(metadata.appleWebApp).toEqual(
        expect.objectContaining({ capable: true }),
      );
      expect(metadata.icons).toEqual(
        expect.objectContaining({ apple: '/icons/apple-touch-icon.png' }),
      );
    });
  });

  describe('viewport', () => {
    it('sets a theme color', () => {
      expect(viewport.themeColor).toBeDefined();
    });
  });
});
