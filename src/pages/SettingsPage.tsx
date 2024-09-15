import React, { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "@/store";
import {
  setSubtitleOffset,
  resetSettings,
  setDubbingVolumeMultiplier,
  setVideoVolumeWhilePlayingDubbing,
  setDubbingVoice,
} from "@/store/movieSlice";
import PageLayout from "@/components/ui/PageLayout";
import Button from "@/components/ui/Button";
import { toast } from "react-toastify";
import config from "@/extension/content/config";
import { DubbingMessage, DubbingVoice } from "@/types";
import { createPopper, Instance as PopperInstance } from "@popperjs/core";
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { changeLanguage } from "@/store/languageSlice";

const SettingsPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { t, i18n } = useTranslation();
  const {
    subtitleOffset,
    dubbingVolumeMultiplier,
    videoVolumeWhilePlayingDubbing,
    dubbingVoice,
  } = useSelector((state: RootState) => state.movie);
  const [localOffset, setLocalOffset] = useState(subtitleOffset);
  const [localDubbingVolume, setLocalDubbingVolume] = useState(
    dubbingVolumeMultiplier
  );
  const [localVideoVolume, setLocalVideoVolume] = useState(
    videoVolumeWhilePlayingDubbing
  );
  const [localDubbingVoice, setLocalDubbingVoice] =
    useState<DubbingVoice>(dubbingVoice);

  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const popperInstanceRef = useRef<PopperInstance | null>(null);

  useEffect(() => {
    setLocalOffset(subtitleOffset);
    setLocalDubbingVolume(dubbingVolumeMultiplier);
    setLocalVideoVolume(videoVolumeWhilePlayingDubbing);
    setLocalDubbingVoice(dubbingVoice);
  }, [
    subtitleOffset,
    dubbingVolumeMultiplier,
    videoVolumeWhilePlayingDubbing,
    dubbingVoice,
  ]);

  useEffect(() => {
    if (activeTooltip && tooltipRef.current) {
      const targetElement = document.getElementById(activeTooltip);
      if (targetElement) {
        popperInstanceRef.current = createPopper(
          targetElement,
          tooltipRef.current,
          {
            placement: "bottom",
            modifiers: [
              {
                name: "offset",
                options: {
                  offset: [0, 8],
                },
              },
            ],
          }
        );
      }
    }

    return () => {
      if (popperInstanceRef.current) {
        popperInstanceRef.current.destroy();
        popperInstanceRef.current = null;
      }
    };
  }, [activeTooltip]);

  const handleInfoMouseEnter = (id: string) => {
    setActiveTooltip(id);
  };

  const handleInfoMouseLeave = () => {
    setActiveTooltip(null);
  };

  const handleOffsetChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalOffset(parseFloat(event.target.value));
  };

  const handleDubbingVolumeChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setLocalDubbingVolume(parseFloat(event.target.value));
  };

  const handleVideoVolumeChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setLocalVideoVolume(parseFloat(event.target.value));
  };

  const handleDubbingVoiceChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newVoice = event.target.value as DubbingVoice;
    setLocalDubbingVoice(newVoice);
    dispatch(setDubbingVoice(newVoice));
  };

  const handleApplyChanges = () => {
    dispatch(setSubtitleOffset(localOffset));
    dispatch(setDubbingVolumeMultiplier(localDubbingVolume));
    dispatch(setVideoVolumeWhilePlayingDubbing(localVideoVolume));
    dispatch(setDubbingVoice(localDubbingVoice));
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "setDubbingVolumeMultiplier",
          payload: localDubbingVolume,
        } as DubbingMessage);
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "setVideoVolumeWhilePlayingDubbing",
          payload: localVideoVolume,
        } as DubbingMessage);
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "setDubbingVoice",
          payload: localDubbingVoice,
        } as DubbingMessage);
      }
    });
    toast.success(t("settingsApplied"));
  };

  const handleReset = () => {
    dispatch(resetSettings());
    dispatch(setDubbingVolumeMultiplier(1));
    dispatch(
      setVideoVolumeWhilePlayingDubbing(config.videoVolumeWhilePlayingDubbing)
    );
    dispatch(setDubbingVoice("echo"));
    setLocalOffset(0);
    setLocalDubbingVolume(1);
    setLocalVideoVolume(config.videoVolumeWhilePlayingDubbing);
    setLocalDubbingVoice("echo");
    toast.success(t("settingsReset"));
  };

  const handleLanguageChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newLanguage = event.target.value;
    dispatch(changeLanguage(newLanguage));
  };

  const availableLanguages = [
    { code: "en", name: "English" },
    { code: "es", name: "Español" },
    { code: "zh", name: "中文" },
    { code: "hi", name: "हिन्दी" },
    { code: "ar", name: "العربية" },
    { code: "pt", name: "Português" },
    { code: "bn", name: "বাংলা" },
    { code: "ru", name: "Русский" },
    { code: "ja", name: "日本語" },
    { code: "pa", name: "ਪੰਜਾਬੀ" },
    { code: "de", name: "Deutsch" },
    { code: "jv", name: "Basa Jawa" },
    { code: "ko", name: "한국어" },
    { code: "fr", name: "Français" },
    { code: "te", name: "తెలుగు" },
    { code: "mr", name: "मराठी" },
    { code: "tr", name: "Türkçe" },
  ];

  return (
    <PageLayout title={t("dubbingSettings")}>
      <div className="space-y-6">
        <div className="mb-4">
          <label
            htmlFor="language-select"
            className="block text-sm font-medium text-foreground mb-2"
          >
            {t("language")}
          </label>
          <select
            id="language-select"
            value={i18n.language}
            onChange={handleLanguageChange}
            className="w-full p-2 border rounded bg-background text-foreground border-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
          >
            {availableLanguages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label
            htmlFor="dubbing-voice-select"
            className="block text-sm font-medium text-foreground mb-2"
          >
            {t("dubbingVoice")}
          </label>
          <select
            id="dubbing-voice-select"
            value={localDubbingVoice}
            onChange={handleDubbingVoiceChange}
            className="w-full p-2 border rounded bg-background text-foreground border-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
          >
            <option value="alloy">Alloy</option>
            <option value="echo">Echo</option>
            <option value="fable">Fable</option>
            <option value="onyx">Onyx</option>
            <option value="nova">Nova</option>
            <option value="shimmer">Shimmer</option>
          </select>
        </div>

        <div className="space-y-6">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="subtitle-offset"
                className="block text-sm font-medium text-foreground"
              >
                {t("subtitleOffset")}
              </label>
              <div
                id="subtitle-offset-info"
                className="cursor-help"
                onMouseEnter={() =>
                  handleInfoMouseEnter("subtitle-offset-info")
                }
                onMouseLeave={handleInfoMouseLeave}
              >
                <Info size={20} className="text-muted-foreground" />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <input
                id="subtitle-offset"
                type="range"
                min="-10"
                max="10"
                step="0.1"
                value={localOffset}
                onChange={handleOffsetChange}
                className="flex-grow h-2 rounded-lg appearance-none cursor-pointer bg-muted"
              />
              <span className="w-16 text-right text-foreground">
                {localOffset.toFixed(1)}s
              </span>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="dubbing-volume"
                className="block text-sm font-medium text-foreground"
              >
                {t("dubbingVolume")}
              </label>
              <div
                id="dubbing-volume-info"
                className="cursor-help"
                onMouseEnter={() => handleInfoMouseEnter("dubbing-volume-info")}
                onMouseLeave={handleInfoMouseLeave}
              >
                <Info size={20} className="text-muted-foreground" />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <input
                id="dubbing-volume"
                type="range"
                min="0"
                max={config.maxDubbingVolumeMultiplier}
                step="0.1"
                value={localDubbingVolume}
                onChange={handleDubbingVolumeChange}
                className="flex-grow h-2 rounded-lg appearance-none cursor-pointer bg-muted"
              />
              <span className="w-16 text-right text-foreground">
                {(localDubbingVolume * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="video-volume"
                className="block text-sm font-medium text-foreground"
              >
                {t("videoVolumeDuringDubbing")}
              </label>
              <div
                id="video-volume-info"
                className="cursor-help"
                onMouseEnter={() => handleInfoMouseEnter("video-volume-info")}
                onMouseLeave={handleInfoMouseLeave}
              >
                <Info size={20} className="text-muted-foreground" />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <input
                id="video-volume"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={localVideoVolume}
                onChange={handleVideoVolumeChange}
                className="flex-grow h-2 rounded-lg appearance-none cursor-pointer bg-muted"
              />
              <span className="w-16 text-right text-foreground">
                {(localVideoVolume * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        <div className="flex space-x-4 pt-4">
          <Button
            onClick={handleApplyChanges}
            variant="primary"
            className="flex-1"
          >
            {t("applyChanges")}
          </Button>
          <Button onClick={handleReset} variant="outline" className="flex-1">
            {t("resetToDefault")}
          </Button>
        </div>
      </div>

      {activeTooltip && (
        <div
          ref={tooltipRef}
          className="bg-background text-foreground p-2 rounded-md text-sm z-10 border border-muted-foreground shadow-sm"
        >
          {activeTooltip === "subtitle-offset-info" && t("subtitleOffsetInfo")}
          {activeTooltip === "dubbing-volume-info" && t("dubbingVolumeInfo")}
          {activeTooltip === "video-volume-info" && t("videoVolumeInfo")}
        </div>
      )}
    </PageLayout>
  );
};

export default SettingsPage;
