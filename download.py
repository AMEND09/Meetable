import urllib.request
import os
import sys

# The exact CDN URLs to ensure valid JS response
urls = {
    "extension/utils/libs/tf.min.js": "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js",
    "extension/utils/libs/speech-commands.min.js": "https://cdn.jsdelivr.net/npm/@tensorflow-models/speech-commands@0.5.4/dist/speech-commands.min.js",
    "extension/utils/libs/vision_bundle.js": "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.cjs",
    "extension/utils/libs/audio_bundle.js": "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@0.10.0/audio_bundle.js"
}

os.makedirs('extension/utils/libs', exist_ok=True)

for path, url in urls.items():
    print(f"Downloading {url} to {path}...")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            content = response.read()
            
            # Validation 1: HTTP Status code (urllib throws error for 404, but just to be sure)
            if response.status != 200:
                print(f"ERROR: Received HTTP {response.status} for {url}")
                sys.exit(1)
                
            # Validation 2: Check for 404 strings like "Not Found" inside the response
            text_preview = content[:200].decode('utf-8', errors='ignore').lower()
            if "not found" in text_preview or "404" in text_preview:
                print(f"ERROR: Received 404 response payload for {url}")
                sys.exit(1)
            
            # Validation 3: Validate strict UTF-8 decoding
            try:
                # This guarantees that the stream byte array has no mangled bytes 
                # that would throw Chrome's "not UTF-8 encoded" error on load.
                content.decode('utf-8')
            except UnicodeDecodeError as e:
                print(f"ERROR: {path} is not valid UTF-8! Details: {e}")
                sys.exit(1)
                
            # Write bytes exactly as they arrived from server, preserving UTF-8 string encoding natively
            with open(path, 'wb') as f:
                f.write(content)
            
            print(f"Successfully validated and saved {path}")
            
    except Exception as e:
        print(f"Failed to download {url}. Error: {e}")
        sys.exit(1)

print("All dependencies successfully validated and correctly formatted.")
