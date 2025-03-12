# Hooks

## useKeyboardShortcuts

Made this hook to handle keyboard shortcuts in a consistent, type-safe, reusable, maintainable way across the application.

### Basic Usage

```tsx
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

const MyComponent = () => {
  const { shortcutsMapped } = useKeyboardShortcuts([
    {
      command: 'nextPage',
      handler: () => {
        console.log('Next page');
      },
    },
    {
      command: 'prevPage',
      handler: () => {
        console.log('Previous page');
      },
    },
  ]);

  return <div>Press keyboard shortcuts</div>;
};
```

### Advance Usage

```tsx
import { useRef } from 'react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

const Reader = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isEnabled, setIsEnabled] = useState(true);

  const { triggerShortcut } = useKeyboardShortcuts(
    [
      {
        command: 'nextPage',
        handler: () => { /* ... */},
        allowInInputs: false,
        allowRepeated: false,
      },
    ],
    {
      enabled: isEnabled,
      focusElement: containerRef,
      showShortcutText: true,
      // ignore modifier keys when pressed alone
      limitedKeyFormat: true,
    }
  );

  const handleButtonClick = () => {
    triggerShortcut('nextPage');
  };

  return (
    <div ref={containerRef} tabIndex={-1}>
      <button onClick={handleButtonClick}>Next Page</button>
    </div>
  );
};
```

## Specialized Hooks

`useReaderShortcuts` in `src/renderer/features/reader/hooks/useReaderShortcuts.ts`

```tsx
import { useReaderShortcuts } from './useReaderShortcuts';

const Reader = () => {
  const readerRef = useRef<HTMLDivElement>(null);
  const [zenMode, setZenMode] = useState(false);
  
  const { refs } = useReaderShortcuts({
    readerRef,
    makeScrollPos: () => { /* ... */ },
    setShortcutText: (text) => { /* ... */ },
    openNextPage: () => { /* ... */ },
    openPrevPage: () => { /* ... */ },
    toggleZenMode: (value) => setZenMode(prev => value ?? !prev),
    isReaderOpen: true,
    isSettingOpen: false,
    isLoadingContent: false,
  });
  
  return (
    <div ref={readerRef} className="reader">
      {/* ... */}
      <button ref={refs.navToPageButtonRef}>Go to Page</button>
      <button ref={refs.readerSettingExtender}>Settings</button>
      {/* ... */}
    </div>
  );
};
```
