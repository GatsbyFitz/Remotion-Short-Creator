"use client";

import type { NextPage } from "next";
import { SubmitEvent } from "react";

const VideoGenerator: NextPage = () => {

  async function handleGenerateVideo(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget)

    try {
      const response = await fetch("/api/generateVideo", {
        method: "POST",
        body:formData,
      })

      const data = await response.json();

      console.log("Video generation response:", data);

    } catch (error) {
      console.error("Error generating video:", error);
    }
  }

  return (
    <div className="px-6 py-10 text-foreground">
      <h1 className="mb-4 text-3xl font-bold">Video Generator</h1>
      <form onSubmit={handleGenerateVideo} className="space-y-4">
        <div>
          <label htmlFor="projectId" className="block text-sm font-medium text-muted-foreground">
            Project ID
          </label>
          <input
            type="text"
            id="projectId"
            name="projectId"
            required
            className="mt-1 block w-full rounded-md border-input bg-background text-foreground shadow-sm focus:border-ring focus:ring-ring sm:text-sm"
          />
        </div>
          <label htmlFor="videoSettings" className="block text-sm font-medium text-muted-foreground">
            Video Settings (JSON)
          </label>
          <textarea
            id="videoSettings"
            name="videoSettings"
            required
            rows={4}
            className="mt-1 block w-full rounded-md border-input bg-background text-foreground shadow-sm focus:border-ring focus:ring-ring sm:text-sm"
          ></textarea>
          </form>
        </div>
  );
};

export default VideoGenerator;
