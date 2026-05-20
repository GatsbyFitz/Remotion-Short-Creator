"use client";

import React, {useState} from "react";
import type { NextPage } from "next";
import {Card, CardHeader} from "src/components/ui/card";
import {renderMediaOnWeb} from '@remotion/web-renderer';
import {Video} from "@remotion/media";

const Home: NextPage = () => {
  const [isRendering, setIsRendering] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const Component: React.FC = () => {
  return <Video src="https://remotion.media/video.mp4" />;
};

  const handleRender = async () => {
    try {
      setIsRendering(true);
      const {getBlob} = await renderMediaOnWeb({
        composition: {
          component: Component,
          durationInFrames: 100,
          fps: 30,
          width: 1920,
          height: 1080,
          id: 'my-composition',
          },
      });

      const blob = await getBlob();
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
    } catch (err) {
      // For now, just log — consider showing a UI error message
      // eslint-disable-next-line no-console
      console.error('Render failed', err);
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <div className="container mx-auto p-10">
      <h1 className="text-2xl font-bold mb-2">Welcome to the Remotion Shorts Workflow!</h1>
      <p className="mb-4">This is the main page for managing your video rendering workflow.</p>

      <Card>
        <CardHeader>Render Preview</CardHeader>

        <div className="p-4">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            onClick={handleRender}
            disabled={isRendering}
          >
            {isRendering ? 'Rendering...' : 'Render Composition'}
          </button>

          {blobUrl && (
            <div className="mt-4">
              <video src={blobUrl} controls width={300} />
              <div className="mt-2">
                <a href={blobUrl} download="render.webm" className="text-blue-600 underline">Download</a>
              </div>
            </div>
          )}
        </div>
      </Card>

    </div>
  );
};

export default Home;
