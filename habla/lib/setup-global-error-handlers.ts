type GlobalErrorHandler = (error: Error, isFatal?: boolean) => void;

type ErrorUtilsLike = {
  getGlobalHandler: () => GlobalErrorHandler;
  setGlobalHandler: (handler: GlobalErrorHandler) => void;
};

let installed = false;

export function setupGlobalErrorHandlers(): void {
  if (installed) return;
  installed = true;

  const globalObj = globalThis as typeof globalThis & {
    ErrorUtils?: ErrorUtilsLike;
  };

  if (globalObj.ErrorUtils) {
    const originalHandler = globalObj.ErrorUtils.getGlobalHandler();
    globalObj.ErrorUtils.setGlobalHandler((error, isFatal) => {
      console.log('Global Error:', error);
      console.log('Is Fatal:', isFatal);
      if (originalHandler) {
        originalHandler(error, isFatal);
      }
    });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rejectionTracking = require('promise/setimmediate/rejection-tracking') as {
      enable: (options: {
        allRejections: boolean;
        onUnhandled: (id: number, error: Error) => void;
        onHandled: (id: number) => void;
      }) => void;
    };
    rejectionTracking.enable({
      allRejections: true,
      onUnhandled: (_id, error) => {
        console.log('Unhandled Promise Rejection:', error);
      },
      onHandled: () => {
        // no-op
      },
    });
  } catch {
    // promise rejection tracking is optional (not available on web)
  }
}
