import React from "react";
import {
  TwitterShareButton,
  FacebookShareButton,
  LinkedinShareButton,
  RedditShareButton,
  TwitterIcon,
  FacebookIcon,
  LinkedinIcon,
  RedditIcon,
} from "react-share";
import { useTranslation } from "react-i18next";

const SocialShareButtons: React.FC = () => {
  const { t } = useTranslation();
  const shareUrl =
    "https://chromewebstore.google.com/detail/onedub/cphceeehafncfeigajlnajkbddokpnbn";
  const shareTitle =
    "Check out OneDub: AI-Powered Real-Time Movie Dubbing for Global Movie and TV Show Streaming websites!";

  return (
    <div className="w-full">
      <div className="flex space-x-4">
        <TwitterShareButton url={shareUrl} title={shareTitle}>
          <TwitterIcon size={32} round />
        </TwitterShareButton>
        <FacebookShareButton url={shareUrl}>
          <FacebookIcon size={32} round />
        </FacebookShareButton>
        <LinkedinShareButton url={shareUrl} title={shareTitle}>
          <LinkedinIcon size={32} round />
        </LinkedinShareButton>
        <RedditShareButton url={shareUrl} title={shareTitle}>
          <RedditIcon size={32} round />
        </RedditShareButton>
      </div>
    </div>
  );
};

export default SocialShareButtons;
