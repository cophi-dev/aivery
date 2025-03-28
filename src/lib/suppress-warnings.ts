/**
 * This file contains utilities to suppress specific React warnings
 * that occur due to MongoDB ObjectIDs having a toJSON method
 */

// Only run this on the client side
if (typeof window !== 'undefined') {
  // For client-side console warnings
  const originalConsoleError = console.error;
  
  console.error = function(...args: any[]) {
    const errorMsg = args[0] && typeof args[0] === 'string' ? args[0] : '';
    
    // Check if this is a warning about MongoDB ObjectIDs or buffer objects
    if (
      errorMsg.includes('Objects with toJSON methods are not supported') ||
      errorMsg.includes('Only plain objects can be passed') ||
      errorMsg.includes('_id: {buffer:') ||
      errorMsg.includes('buffer:')
    ) {
      // Suppress the warning
      return;
    }
    
    // Otherwise, pass through to the original console.error
    originalConsoleError.apply(console, args);
  };
  
  // Also suppress console warnings about buffer properties
  const originalConsoleWarn = console.warn;
  
  console.warn = function(...args: any[]) {
    const warnMsg = args[0] && typeof args[0] === 'string' ? args[0] : '';
    
    // Check if this is a warning about MongoDB ObjectIDs or buffer objects
    if (
      warnMsg.includes('Objects with toJSON methods are not supported') ||
      warnMsg.includes('Only plain objects can be passed') ||
      warnMsg.includes('buffer:')
    ) {
      // Suppress the warning
      return;
    }
    
    // Otherwise, pass through to the original console.warn
    originalConsoleWarn.apply(console, args);
  };
}

// For Next.js development error overlay
if (typeof window !== 'undefined') {
  // Hide specific error messages in the error overlay
  const originalErrorOverlay = window.addEventListener;
  
  window.addEventListener = function(
    type: string, 
    listener: EventListenerOrEventListenerObject, 
    options?: boolean | AddEventListenerOptions
  ) {
    if (type === 'error' || type === 'unhandledrejection') {
      // Wrap the listener to filter out MongoDB buffer warnings
      const wrappedListener = function(event: Event) {
        // Only allow the error to propagate if it's not related to buffer warnings
        const errorEvent = event as ErrorEvent | PromiseRejectionEvent;
        const errorMsg = (errorEvent as ErrorEvent)?.error?.message || 
                         (errorEvent as PromiseRejectionEvent)?.reason?.message || 
                         '';
        
        if (
          errorMsg.includes('Objects with toJSON methods') ||
          errorMsg.includes('buffer:') ||
          errorMsg.includes('Only plain objects can be passed')
        ) {
          // Suppress the error event
          event.stopImmediatePropagation?.();
          event.preventDefault?.();
          return false;
        }
        
        // Call the original listener for other errors
        if (typeof listener === 'function') {
          return listener.apply(window, [event]);
        } else if (listener && typeof listener.handleEvent === 'function') {
          return listener.handleEvent.call(listener, event);
        }
      };
      
      // Call the original addEventListener with our wrapped listener
      return originalErrorOverlay.call(window, type, wrappedListener as EventListener, options);
    }
    
    // Call the original addEventListener for other event types
    return originalErrorOverlay.call(window, type, listener, options);
  };
}

// Not effective - using JSON.stringify instead
export {}; 