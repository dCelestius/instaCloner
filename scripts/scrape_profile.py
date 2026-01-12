import sys
import json
import os
import instaloader
from datetime import datetime
import contextlib

class StdoutRedirect:
    def __enter__(self):
        self._original_stdout = sys.stdout
        sys.stdout = open(os.devnull, 'w')
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        sys.stdout.close()
        sys.stdout = self._original_stdout

# Helper to serialize datetime objects
def default_serializer(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

def scrape_profile(username, output_dir, max_count=12):
    """
    Scrapes the last N reels from a public profile using Instaloader.
    Downloads thumbnails and video files.
    """
    # Quiet mode to prevent stdout pollution
    L = instaloader.Instaloader(
        download_pictures=True,
        download_videos=True, 
        download_video_thumbnails=True,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        compress_json=False,
        quiet=True
    )

    # Try to load cookies.txt
    import http.cookiejar
    cookie_path = os.path.join(os.path.dirname(__file__), '..', 'cookies.txt')
    if os.path.exists(cookie_path):
        try:
            L.context._session.cookies = http.cookiejar.MozillaCookieJar(cookie_path)
            L.context._session.cookies.load(ignore_discard=True, ignore_expires=True)
            sys.stderr.write(f"Loaded cookies from {cookie_path}\n")
        except Exception as e:
            sys.stderr.write(f"Failed to load cookies: {e}\n")
    
    try:
        profile = instaloader.Profile.from_username(L.context, username)
    except Exception as e:
        # Fallback for user error logging (stderr)
        sys.stderr.write(json.dumps({"error": str(e)}) + "\n")
        # Return empty array to trigger fallback in backend if strictly needed, 
        # or exit with error 
        print(json.dumps([])) 
        return

    reels_data = []
    count = 0
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Change to output directory to avoid path issues
    start_dir = os.getcwd()
    os.chdir(output_dir)

    # Use shortcode as filename pattern for deterministic matching
    L.filename_pattern = "{shortcode}"
    # Force current directory (dot) to avoid subdirectory creation or empty path errors
    L.dirname_pattern = "."

    # Use iterator - profile already loaded above
    posts = profile.get_posts()
    
    # Iterate posts
    for post in posts:
        if count >= max_count:
            break
            
        if post.is_video:
            try:
                # Redirect stdout to suppress Instaloader logs
                with open(os.devnull, 'w') as fnull:
                    with contextlib.redirect_stdout(fnull):
                        # Passing target='.' ensures dirname_pattern '.' is used/validated
                        L.download_post(post, target='.')
                
                # Deterministic filename based on shortcode
                basename = post.shortcode
                video_filename = f"{basename}.mp4"
                thumb_filename = f"{basename}.jpg"
                
                # Verify file exists (relative check in CWD)
                local_video_exists = os.path.exists(video_filename)
                
                # Debug Check
                if not local_video_exists:
                     sys.stderr.write(f"checking {video_filename} in {os.getcwd()}\n")
                     sys.stderr.write(f"files: {os.listdir('.')}\n")

                local_thumb_exists = os.path.exists(thumb_filename)
                
                # Construct data
                reels_data.append({
                    "id": post.shortcode,
                    "filename_base": basename, 
                    "url": post.video_url, 
                    "local_video_path": video_filename if local_video_exists else None,
                    "local_thumb_path": thumb_filename if local_thumb_exists else None,
                    "thumbnail": post.url, 
                    "username": profile.username,
                    "views": post.video_view_count,
                    "likes": post.likes,
                    "comments": post.comments,
                    "score": (post.video_view_count or 0) + ((post.likes or 0) * 2),
                    "caption": post.caption,
                    "status": "approved",
                    "playable_url": post.video_url
                })
                
                count += 1
            except Exception as e:
                sys.stderr.write(f"Error processing post {post.shortcode}: {e}\n")
                continue
    
    print(json.dumps(reels_data, default=default_serializer))

if __name__ == "__main__":
    if len(sys.argv) < 3:
        # Print empty array or error structure
        print(json.dumps([]))
        sys.exit(1)
        
    username = sys.argv[1]
    output_dir = sys.argv[2]
    
    # Simple extraction
    if "instagram.com" in username:
        # handle trailing slash or query params
        username = username.split("instagram.com/")[1].split("/")[0].split("?")[0]
        
    # Parse optional max_count
    max_count = 12
    if len(sys.argv) > 3:
        try:
            max_count = int(sys.argv[3])
        except:
            max_count = 12

    scrape_profile(username, output_dir, max_count)
