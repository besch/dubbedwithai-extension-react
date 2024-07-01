import { RootState } from "@/store";

export const saveState = (state: RootState) => {
  chrome.storage.local.set({ movieState: state.movie }, () => {
    if (chrome.runtime.lastError) {
      console.error("Error saving state:", chrome.runtime.lastError);
    }
  });
};

export const loadState = (): Promise<Partial<RootState> | undefined> => {
  return new Promise((resolve) => {
    chrome.storage.local.get("movieState", (result) => {
      if (chrome.runtime.lastError) {
        console.error("Error loading state:", chrome.runtime.lastError);
        resolve(undefined);
      } else {
        resolve(result.movieState ? { movie: result.movieState } : undefined);
      }
    });
  });
};
