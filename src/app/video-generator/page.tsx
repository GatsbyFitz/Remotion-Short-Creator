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
    <div className="px-6 py-10 text-slate-100">
      <h1 className="mb-4 text-3xl font-bold">Video Generator</h1>
      <form onSubmit={handleGenerateVideo} className="space-y-4">
        <div>
          <label htmlFor="projectId" className="block text-sm font-medium text-slate-300">
            Project ID
          </label>
          <input
            type="text"
            id="projectId"
            name="projectId"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
          <label htmlFor="videoSettings" className="block text-sm font-medium text-slate-300">
            Video Settings (JSON)
          </label>
          <textarea
            id="videoSettings"
            name="videoSettings"
            required
            rows={4}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          ></textarea>
          </form>
        </div>
  );
};

export default VideoGenerator;
