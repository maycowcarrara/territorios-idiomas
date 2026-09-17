import { describe, it, expect } from 'vitest';
import {
  cn,
  buttonClass,
  iconButtonClass,
  cardBaseClass,
  fieldBaseClass,
  buttonBaseClass,
  buttonToneClass,
  badgeBaseClass
} from '../../src/uiClasses';

describe('uiClasses design system tokens and utilities', () => {
  it('cn should join truthy classes and ignore falsy ones', () => {
    expect(cn('btn', null, undefined, false, 'btn-primary')).toBe('btn btn-primary');
    expect(cn()).toBe('');
  });

  it('buttonClass should return base class with tone class and optional extra classes', () => {
    const primary = buttonClass('primary');
    expect(primary).toContain(buttonBaseClass);
    expect(primary).toContain(buttonToneClass.primary);

    const withExtra = buttonClass('secondary', 'w-full custom-class');
    expect(withExtra).toContain(buttonToneClass.secondary);
    expect(withExtra).toContain('w-full custom-class');
  });

  it('buttonClass should fallback to primary tone when an unknown tone is provided', () => {
    const fallback = buttonClass('unknown-tone');
    expect(fallback).toContain(buttonToneClass.primary);
  });

  it('iconButtonClass should return base class with tone and custom class', () => {
    const ghost = iconButtonClass('ghost');
    expect(ghost).toContain('inline-flex');
    expect(ghost).toContain('h-10 w-10');

    const white = iconButtonClass('white', 'ml-2');
    expect(white).toContain('bg-white/10');
    expect(white).toContain('ml-2');

    const fallback = iconButtonClass('non-existent');
    expect(fallback).toContain('text-slate-600');
  });

  it('should export all standard static class strings', () => {
    expect(typeof cardBaseClass).toBe('string');
    expect(cardBaseClass.length).toBeGreaterThan(0);

    expect(typeof fieldBaseClass).toBe('string');
    expect(fieldBaseClass.length).toBeGreaterThan(0);

    expect(typeof badgeBaseClass).toBe('string');
    expect(badgeBaseClass.length).toBeGreaterThan(0);
  });
});
