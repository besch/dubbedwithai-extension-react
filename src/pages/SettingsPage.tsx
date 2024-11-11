import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "@/store";
import { updateAllSettings } from "@/store/movieSlice";
import PageLayout from "@/components/ui/PageLayout";
import Button from "@/components/ui/Button";
import { toast } from "react-toastify";
import config from "@/extension/content/config";
import { DubbingMessage, DubbingVoice } from "@/types";
import { Globe, Minus, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { changeLanguage } from "@/store/languageSlice";
import InfoTooltip from "@/components/ui/InfoTooltip";

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

  const handleOffsetChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalOffset(parseFloat(event.target.value));
  };

  const adjustOffset = (amount: number) => {
    const newOffset = Math.max(-60, Math.min(60, localOffset + amount));
    setLocalOffset(Number(newOffset.toFixed(1)));
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
  };

  const handleApplyChanges = () => {
    dispatch(
      updateAllSettings({
        subtitleOffset: localOffset,
        dubbingVolumeMultiplier: localDubbingVolume,
        videoVolumeWhilePlayingDubbing: localVideoVolume,
        dubbingVoice: localDubbingVoice,
      })
    );

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "applySettingsChanges",
          payload: {
            subtitleOffset: localOffset,
            dubbingVolumeMultiplier: localDubbingVolume,
            videoVolumeWhilePlayingDubbing: localVideoVolume,
            dubbingVoice: localDubbingVoice,
          },
        } as DubbingMessage);
      }
    });
    toast.success(t("settingsApplied"));
  };

  const handleReset = () => {
    const defaultSettings = {
      subtitleOffset: 0,
      dubbingVolumeMultiplier: 1,
      videoVolumeWhilePlayingDubbing: config.videoVolumeWhilePlayingDubbing,
      dubbingVoice: config.defaultVoice,
    };

    dispatch(updateAllSettings(defaultSettings));

    setLocalOffset(defaultSettings.subtitleOffset);
    setLocalDubbingVolume(defaultSettings.dubbingVolumeMultiplier);
    setLocalVideoVolume(defaultSettings.videoVolumeWhilePlayingDubbing);
    setLocalDubbingVoice(defaultSettings.dubbingVoice);

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
    { code: "pa", name: "ਪੰਜਾਂਬੀ" },
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
        <div className="flex justify-end items-center mb-4">
          <div className="flex items-center">
            <Globe className="w-4 h-4 mr-2 text-muted-foreground" />
            <select
              id="language-select"
              value={i18n.language}
              onChange={handleLanguageChange}
              className="p-1 text-sm border rounded bg-background text-foreground border-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
            >
              {availableLanguages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>
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
              <InfoTooltip
                id="subtitle-offset-info"
                content={t("subtitleOffsetInfo")}
              />
            </div>
            <div className="flex items-center space-x-2 mb-2">
              <Button
                onClick={() => adjustOffset(-1)}
                variant="outline"
                size="sm"
                className="w-16"
              >
                <Minus className="w-3 h-3 mr-1" /> 1s
              </Button>
              <Button
                onClick={() => adjustOffset(-0.1)}
                variant="outline"
                size="sm"
                className="w-16"
              >
                -0.1s
              </Button>
              <div className="flex-grow text-center font-medium">
                {localOffset.toFixed(1)}s
              </div>
              <Button
                onClick={() => adjustOffset(0.1)}
                variant="outline"
                size="sm"
                className="w-16"
              >
                +0.1s
              </Button>
              <Button
                onClick={() => adjustOffset(1)}
                variant="outline"
                size="sm"
                className="w-16"
              >
                <Plus className="w-3 h-3 mr-1" /> 1s
              </Button>
            </div>
            <div className="flex items-center space-x-4">
              <input
                id="subtitle-offset"
                type="range"
                min="-60"
                max="60"
                step="0.1"
                value={localOffset}
                onChange={handleOffsetChange}
                className="flex-grow h-2 rounded-lg appearance-none cursor-pointer bg-muted"
              />
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
              <InfoTooltip
                id="dubbing-volume-info"
                content={t("dubbingVolumeInfo")}
              />
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
              <InfoTooltip
                id="video-volume-info"
                content={t("videoVolumeInfo")}
              />
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
    </PageLayout>
  );
};

export default SettingsPage;
