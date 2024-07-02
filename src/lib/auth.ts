export function initiateGoogleAuth(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (token) {
        chrome.storage.local.set({ authToken: token }, () => {
          console.log("Token stored");
        });
        resolve(token);
      } else {
        reject(new Error("Failed to obtain auth token"));
      }
    });
  });
}

export function getAuthToken(): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    chrome.storage.local.get(
      ["authToken"],
      (result: { authToken?: string }) => {
        resolve(result.authToken || null);
      }
    );
  });
}

export function clearAuthToken(): Promise<void> {
  return new Promise<void>((resolve) => {
    chrome.identity.clearAllCachedAuthTokens(() => {
      chrome.storage.local.remove(["authToken"], () => {
        console.log("Token cleared");
        resolve();
      });
    });
  });
}
