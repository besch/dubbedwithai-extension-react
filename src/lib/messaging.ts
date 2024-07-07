// src/utils/messaging.ts

export const sendMessageToActiveTab = (
  message: any,
  timeout = 5000
): Promise<any> => {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        const timer = setTimeout(() => {
          reject(new Error("Message response timed out"));
        }, timeout);

        chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
          clearTimeout(timer);
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      } else {
        reject(new Error("No active tab found"));
      }
    });
  });
};
