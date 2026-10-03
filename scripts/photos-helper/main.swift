// Reels Photos Helper: exports Photos items for the reels workflow through
// PhotoKit, downloading anything that's only in iCloud and preferring the
// edited version of each photo or clip.
//
// Built into a minimal app bundle and launched with `open`, so macOS treats it
// as its own app and asks for Photos access in its name. A plain command-line
// tool inherits the permissions of whatever launched it (the terminal or
// editor running the dev server), which usually can't be granted Photos access.
//
// Usage: ReelsPhotosHelper <request.json>
//   request:  { "outDir": "...", "ids": ["<PHAsset localIdentifier>", ...], "responsePath": "..." }
//   response: { "error": "denied" | null, "items": [{ "id", "file", "error" }] }
// Files are written to outDir as <index>.<ext>, in the order of `ids`.

import Foundation
import Photos

struct Request: Decodable {
  let outDir: String
  let ids: [String]
  let responsePath: String
}

struct Exported: Encodable {
  let id: String
  var file: String?
  var error: String?
}

struct Response: Encodable {
  var error: String?
  var items: [Exported]
}

// Export completions arrive on PhotoKit's own queues.
final class Results: @unchecked Sendable {
  private var items: [Exported]
  private let lock = NSLock()

  init(ids: [String]) { items = ids.map { Exported(id: $0, file: nil, error: nil) } }

  func set(_ index: Int, file: String? = nil, error: String? = nil) {
    lock.lock()
    items[index].file = file
    items[index].error = error
    lock.unlock()
  }

  var all: [Exported] {
    lock.lock()
    defer { lock.unlock() }
    return items
  }
}

guard
  let requestPath = CommandLine.arguments.dropFirst().first,
  let data = FileManager.default.contents(atPath: requestPath),
  let request = try? JSONDecoder().decode(Request.self, from: data)
else {
  FileHandle.standardError.write("Usage: ReelsPhotosHelper <request.json>\n".data(using: .utf8)!)
  exit(64)
}

func respond(_ response: Response) -> Never {
  let encoded = (try? JSONEncoder().encode(response)) ?? Data("{\"error\":\"encode\",\"items\":[]}".utf8)
  FileManager.default.createFile(atPath: request.responsePath, contents: encoded)
  exit(0)
}

var status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
if status == .notDetermined {
  let answered = DispatchSemaphore(value: 0)
  PHPhotoLibrary.requestAuthorization(for: .readWrite) { granted in
    status = granted
    answered.signal()
  }
  answered.wait()
}

guard status == .authorized || status == .limited else {
  respond(Response(error: "denied", items: []))
}

var assets: [String: PHAsset] = [:]
PHAsset.fetchAssets(withLocalIdentifiers: request.ids, options: nil).enumerateObjects { asset, _, _ in
  assets[asset.localIdentifier] = asset
}

let results = Results(ids: request.ids)
let slots = DispatchSemaphore(value: 4)
let group = DispatchGroup()
let options = PHAssetResourceRequestOptions()
options.isNetworkAccessAllowed = true

for (index, id) in request.ids.enumerated() {
  guard let asset = assets[id] else {
    results.set(index, error: "not found in the library")
    continue
  }

  // The edited rendition when there is one, otherwise the original. A Live
  // Photo exports its still, not its motion clip.
  let resources = PHAssetResource.assetResources(for: asset)
  let preferred: [PHAssetResourceType] = asset.mediaType == .video ? [.fullSizeVideo, .video] : [.fullSizePhoto, .photo]
  guard let resource = preferred.lazy.compactMap({ type in resources.first { $0.type == type } }).first else {
    results.set(index, error: "no exportable photo or video")
    continue
  }

  let ext = (resource.originalFilename as NSString).pathExtension
  let dest = URL(fileURLWithPath: request.outDir)
    .appendingPathComponent(String(format: "%04d", index))
    .appendingPathExtension(ext.isEmpty ? (asset.mediaType == .video ? "mov" : "jpg") : ext.lowercased())
  try? FileManager.default.removeItem(at: dest)

  slots.wait()
  group.enter()
  PHAssetResourceManager.default().writeData(for: resource, toFile: dest, options: options) { error in
    if let error {
      results.set(index, error: error.localizedDescription)
    } else {
      results.set(index, file: dest.path)
    }
    slots.signal()
    group.leave()
  }
}

group.wait()
respond(Response(error: nil, items: results.all))
