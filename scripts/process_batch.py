import sys
import json
import os
import subprocess
import textwrap
import traceback

# Base directory for the frontend project
script_dir = os.path.dirname(os.path.abspath(__file__))
base_dir = os.path.dirname(script_dir)

try:
    from PIL import Image, ImageDraw, ImageFont, ImageOps
except ImportError:
    print("Pillow not installed. Creating without it (will fail for design mode).")

try:
    import cv2
    import numpy as np
    OPENCV_AVAILABLE = True
except ImportError:
    OPENCV_AVAILABLE = False
    print("OpenCV not installed. Auto-detection disabled.")

def get_video_dimensions(input_path):
    """Returns (width, height) of video using ffprobe"""
    try:
        cmd = [
            'ffprobe', 
            '-v', 'error', 
            '-select_streams', 'v:0', 
            '-show_entries', 'stream=width,height', 
            '-of', 'csv=s=x:p=0', 
            input_path
        ]
        output = subprocess.check_output(cmd).decode('utf-8').strip()
        parts = output.split('x')
        return int(parts[0]), int(parts[1])
    except Exception as e:
        print(f"Error getting dimensions for {input_path}: {e}")
        return None

def detect_header_height(video_path, total_height, show_headline=True):
    """
    Analyzes video at multiple timestamps to find the UI header area.
    If show_headline is False, it strictly isolates the profile row (name/handle).
    Returns (final_y, final_h, content_padding)
    """
    if not OPENCV_AVAILABLE:
        print("OpenCV unavailable, using default safe area")
        return 0, int(total_height * 0.15), 20

    try:
        cap = cv2.VideoCapture(video_path)
        
        # Sample multiple frames to be more robust against transitions/animations
        # (Timestamps in ms: 500, 1500, 2500)
        timestamps = [500, 1500, 2500]
        detected_envelopes = []

        for ts in timestamps:
            cap.set(cv2.CAP_PROP_POS_MSEC, ts)
            ret, frame = cap.read()
            if not ret:
                continue

            h, w, _ = frame.shape
            
            # Region of Interest: Top 25% (Headers are rarely lower than this)
            roi_h = int(h * 0.25)
            roi = frame[0:roi_h, 0:w]
            
            # Preprocessing
            gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
            # Blur to merge text blocks
            blurred = cv2.GaussianBlur(gray, (25, 25), 0)
            edges = cv2.Canny(blurred, 30, 100)
            
            # Dilate to connect components
            # Moderate vertical dilation to bridge text lines without merging status bar
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (20, 8))
            dilated = cv2.dilate(edges, kernel, iterations=2)
            
            contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            frame_top = h
            frame_bottom = 0
            found_in_frame = False
            
            # Thresholds for filtering noise (resolution-aware)
            # 5% of width is enough to catch "Evolving AI" but skip tiny dots
            min_w = w * 0.05  
            min_h = h * 0.005 
            # Skip top 4% to avoid OS status bar (clock/battery/pill)
            status_bar_h = h * 0.04 
            
            valid_rects = []
            for cnt in contours:
                x, y, w_rect, h_rect = cv2.boundingRect(cnt)
                
                # Filter noise
                if w_rect < min_w: continue 
                if h_rect < min_h: continue 
                if y < status_bar_h: continue # Skips OS status bar
                
                valid_rects.append((y, y + h_rect))

            if valid_rects:
                if not show_headline:
                    # ULTRA-SLIM: Isolate ONLY the top-most cohesive row (Profile Row)
                    # We sort by Y and only keep the first "cluster"
                    valid_rects.sort(key=lambda r: r[0])
                    first_y = valid_rects[0][0]
                    # Anything starting within 3% of the first element is part of the same "row"
                    row_threshold = h * 0.03
                    profile_rects = [r for r in valid_rects if r[0] < (first_y + row_threshold)]
                    
                    frame_top = min(r[0] for r in profile_rects)
                    frame_bottom = max(r[1] for r in profile_rects)
                else:
                    # Normal: Take full UI envelope (Name + Headline)
                    frame_top = min(r[0] for r in valid_rects)
                    frame_bottom = max(r[1] for r in valid_rects)
                
                found_in_frame = True
            
            if found_in_frame:
                detected_envelopes.append((frame_top, frame_bottom))

        cap.release()

        if not detected_envelopes:
            print("No header structure detected in sampled frames. Using default.")
            return 0, int(total_height * 0.15), 20

        # Aggregate: Use min top and max bottom across all frames for full coverage
        ui_top = min(e[0] for e in detected_envelopes)
        ui_bottom = max(e[1] for e in detected_envelopes)
        
        # Scaling Factors (based on 1920p original targets)
        if not show_headline:
            # PERFECT-FIT: Balancing slimmness with breathing room
            rel_shift_up = int(total_height * 0.02) # Balanced at 2%
            rel_buffer = int(total_height * 0.005)  # 0.5% cushion
            rel_safety_floor = int(total_height * 0.02) # 2% floor
            snap_threshold = 0.02 # Only snap if touching top 2%
        else:
            rel_shift_up = int(total_height * 0.11)
            rel_buffer = int(total_height * 0.01)
            rel_safety_floor = int(total_height * 0.04)
            snap_threshold = 0.05

        # Final Calculations
        final_y = max(0, ui_top - rel_shift_up) 
        
        # SELECTIVE SNAP TO TOP
        if final_y < (total_height * snap_threshold):
             final_y = 0

        final_h = (ui_bottom - final_y) + rel_buffer
        
        # Safety Floor
        if final_h < rel_safety_floor: final_h = rel_safety_floor
            
        # Strict Cap
        max_allowed = int(total_height * (0.10 if not show_headline else 0.16))
        if final_h > max_allowed:
            final_h = max_allowed
            
        content_y = 10 # Tight content padding
        
        print(f"OpenCV (Pass 3): Detected UI {ui_top}-{ui_bottom}. Banner: y={final_y}, h={final_h}")
        return final_y, final_h, content_y

    except Exception as e:
        print(f"CV Error: {e}")
        return 0, int(total_height * 0.15), 20

def create_circular_logo(logo_path, size):
    try:
        img = Image.open(logo_path).convert("RGBA")
        img = ImageOps.fit(img, size, centering=(0.5, 0.5))
        
        mask = Image.new('L', size, 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0, size[0], size[1]), fill=255)
        
        output = Image.new('RGBA', size, (0, 0, 0, 0))
        output.paste(img, (0, 0), mask)
        
        # Border thickness: scale_factor * 1.5 roughly equals 1px visual border
        # We need to pass the scale_factor here or calculate it. 
        # For now, let's use a more subtle relative calculation.
        border_thickness = max(1, int(size[0] * 0.02)) 
        draw_overlay = ImageDraw.Draw(output)
        draw_overlay.ellipse((0, 0, size[0]-1, size[1]-1), outline="white", width=border_thickness)
        
        return output
    except Exception as e:
        print(f"Error processing logo: {e}")
        return Image.new('RGBA', size, (100, 100, 100, 255))

def get_font(size, bold=False):
    font_paths = [
        os.path.join(base_dir, "public", "fonts", "Montserrat-Regular.ttf"),
        os.path.join(base_dir, "public", "fonts", "Montserrat-Light.ttf"),
        "Arial Bold.ttf" if bold else "Arial.ttf",
        "Helvetica-Bold" if bold else "Helvetica",
        "/System/Library/Fonts/Supplemental/Arial.ttf"
    ]
    for path in font_paths:
        try:
            return ImageFont.truetype(path, size)
        except:
            continue
    try:
        return ImageFont.load_default() 
    except:
        return None

def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4)) + (255,)

def generate_design_overlay(job_dir, config, width, height, reel_data, base_dir, layout_override=None):
    """
    Generates the overlay image. 
    layout_override: (final_y, final_h, content_y) from Auto-Detect
    """
    # Create full canvas
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Defaults
    bg_color = (0, 0, 0, 255) # Solid Black default
    
    # Resolve position variables
    if layout_override:
        start_y, block_height, content_padding_top = layout_override
        # RE-CENTERING LOGIC: If the banner is significantly taller than the content padding might suggest,
        # we can adjust content_padding_top to center the content.
        # But for now, we trust the tight padding from the caller.
    else:
        # Manual fallback
        header_percent = config.get('headerHeight', 15)
        if header_percent == 'auto': header_percent = 15 # Safety
        start_y = 0
        block_height = int(height * (header_percent / 100.0))
        content_padding_top = int(width * 0.04)

    # Draw Background Banner
    draw.rectangle(
        [(0, start_y), (width, start_y + block_height)], 
        fill=bg_color
    )
    
    # Scale Factors
    scale_factor = width / 380.0 
    
    # compensated scaling for PIL fonts vs CSS
    FONT_SCALE = 1.35 
    
    # Config Values
    logo_percent = config.get('logoSize', 15)
    logo_size_px = int(width * (logo_percent / 100.0))
    
    name_fs = int(config.get('nameFontSize', 18) * scale_factor * FONT_SCALE)
    name_color = config.get('nameColor', '#ffffff')
    
    badge_size_px = int(config.get('badgeSize', 12) * scale_factor)
    
    handle_fs = int(config.get('handleFontSize', 14) * scale_factor * FONT_SCALE)
    handle_color = config.get('handleColor', '#94a3b8')
    
    headline_fs = int(config.get('headlineFontSize', 24) * scale_factor * FONT_SCALE)
    headline_color = config.get('headlineColor', '#ffffff')
    
    padding_left = int(22 * scale_factor) # pl-[22px]
    padding_vertical = int(12 * scale_factor) # py-3 (0.75rem = 12px)
    gap_horizontal = int(8 * scale_factor) # gap-2 (0.5rem = 8px)
    
    # --- Content Positioning ---
    
    # Logo
    logo_size = (logo_size_px, logo_size_px)
    logo_x = padding_left
    # Align content relative to the banner start + vertical padding
    content_start_y = start_y + padding_vertical
    
    # Micro-adjust logo up slightly for better visual balance
    logo_y = content_start_y - int(3.5 * scale_factor)
    
    logo_path = os.path.join(job_dir, "logo.png")
    if os.path.exists(logo_path):
        # We use a finer border logic in create_circular_logo now
        logo_img = create_circular_logo(logo_path, logo_size)
        img.paste(logo_img, (logo_x, logo_y), logo_img)
    else:
        # Drawing a circular placeholder with an emerald border for consistency
        border_thickness = max(1, int(logo_size_px * 0.02))
        draw.ellipse(
            (logo_x, logo_y, logo_x + logo_size_px, logo_y + logo_size_px), 
            outline="#10b981", # emerald-500
            width=border_thickness
        )

    # Name
    name_text = config.get('designName', 'User')
    font_bold = get_font(name_fs, bold=True)
    
    # Standardize name_x to keep layout consistent whether logo exists or not
    name_x = logo_x + logo_size_px + gap_horizontal
    name_y = logo_y 
    
    draw.text((name_x, name_y), name_text, font=font_bold, fill=name_color)
    
    # Badge
    badge_path = os.path.join(base_dir, "public", "Twitter_Verified_Badge_Gold.svg.png")
    if os.path.exists(badge_path):
        try:
            name_bbox = draw.textbbox((name_x, name_y), name_text, font=font_bold)
            name_w = name_bbox[2] - name_bbox[0]
            
            b_size = (badge_size_px, badge_size_px)
            badge_img = Image.open(badge_path).convert("RGBA")
            badge_img = ImageOps.fit(badge_img, b_size, centering=(0.5, 0.5))
            
            badge_x = name_x + name_w + int(8 * scale_factor)
            badge_y_pos = name_y + (name_fs // 2) - (badge_size_px // 2)
            img.paste(badge_img, (badge_x, badge_y_pos), badge_img)
        except Exception as e:
            # print(f"Badge error: {e}")
            pass

    # Handle
    handle_text = config.get('designHandle', '')
    if handle_text:
        if handle_text.startswith('@'): handle_text = handle_text[1:]
        
        # Try Montserrat specifically for the handle if possible
        handle_font_path = os.path.join(base_dir, "public", "fonts", "Montserrat-Light.ttf")
        if not os.path.exists(handle_font_path):
            handle_font_path = os.path.join(base_dir, "public", "fonts", "Montserrat-Regular.ttf")
            
        try:
            font_reg = ImageFont.truetype(handle_font_path, handle_fs)
            font_at = ImageFont.truetype(handle_font_path, handle_fs + 2)
        except:
            font_reg = get_font(handle_fs, bold=False)
            font_at = get_font(handle_fs + 2, bold=False) 
        
        handle_y = name_y + name_fs
        
        # Draw @ symbol first
        draw.text((name_x, handle_y), "@", font=font_at, fill=handle_color)
        
        # Measure @ width to offset the rest of the handle
        at_bbox = draw.textbbox((name_x, handle_y), "@", font=font_at)
        at_width = at_bbox[2] - at_bbox[0]
        
        # Draw the rest of the handle name
        draw.text((name_x + at_width, handle_y), handle_text, font=font_reg, fill=handle_color)

    # Headline
    show_headline_raw = config.get('showHeadline', True)
    show_headline = str(show_headline_raw).lower() == 'true'
    if show_headline:
        headline_mode = config.get('headlineMode', 'manual')
        headline_text = config.get('manualHeadline', "") if headline_mode == 'manual' else (reel_data.get('generated_headline') or "AI Headline Pending...")
        
        if headline_text:
            font_head = get_font(headline_fs, bold=False)
            text_x = int(24 * scale_factor) # px-6
            # text_y = header_strip_bottom + pt-2
            # header_strip_bottom = logo_y + logo_size_px + padding_vertical
            text_y = logo_y + logo_size_px + padding_vertical + int(8 * scale_factor)
            
            avg_char_width = headline_fs * 0.5
            max_chars = int((width - (text_x * 2)) / avg_char_width)
            lines = textwrap.wrap(headline_text, width=max_chars)
            
            for line in lines:
                draw.text((text_x, text_y), line, font=font_head, fill=headline_color)
                text_y += int(headline_fs * 1.3)
            
    return img

def process_batch(job_id):
    base_dir = os.getcwd()
    jobs_file = os.path.join(base_dir, "data", "jobs.json")
    job_dir = os.path.join(base_dir, "public", "downloads", job_id)
    
    # Fallback Source Folder (Mock Data ID)
    SOURCE_JOB_ID = "0a4c50d9-b8c5-40ff-8ac4-b0449c6d446d"
    source_dir = os.path.join(base_dir, "public", "downloads", SOURCE_JOB_ID)

    if not os.path.exists(jobs_file):
        print("jobs.json not found")
        return

    with open(jobs_file, 'r') as f:
        db = json.load(f)

    job = db.get(job_id)
    if not job:
        print(f"Job {job_id} not found")
        return

    # Parse Config
    config = job.get('config', {})
    mode = config.get('mode', 'upload')
    
    # headerHeight slider was removed. We use Auto-Height or Default.
    # If config still has it, ignore it or use as safety fallback? 
    # User requested "dependend on header size", so we use auto-detect logic.
    
    # Check for new boolean flag
    auto_detect_pos_str = str(config.get('autoDetectPosition', 'true')).lower()
    auto_detect = (auto_detect_pos_str == 'true')

    # Parse Vertical Correction
    vertical_correction = int(config.get('verticalCorrection', 0))

    print(f"Processing Job {job_id} | Mode: {mode} | AutoDetect: {auto_detect}")

    reels = job.get('reels', [])
    processed_count = 0

    for reel in reels:
        # Check Status
        if reel.get('status') != 'approved':
            continue

        local_filename = reel.get('local_video_path')
        
        # Self-healing: If DB says no file, check if {id}.mp4 exists (legacy/manual fix)
        if not local_filename:
            guessed_filename = f"{reel['id']}.mp4"
            if os.path.exists(os.path.join(job_dir, guessed_filename)):
                print(f"Self-healed: Found {guessed_filename} despite missing DB entry")
                local_filename = guessed_filename
        
        if not local_filename:
            print(f"Skipping {reel['id']} - no local file defined")
            continue
            
        # Try finding the file
        input_path = os.path.join(job_dir, local_filename)
        if not os.path.exists(input_path):
            # FALLBACK to source
            fallback_path = os.path.join(source_dir, local_filename)
            if os.path.exists(fallback_path):
                print(f"Found input in fallback source: {local_filename}")
                input_path = fallback_path
            else:
                print(f"Input file missing: {input_path}")
                continue

        dims = get_video_dimensions(input_path)
        if not dims: continue
        width, height = dims
        
        # Prepare Overlay
        temp_overlay_path = None
        filter_complex = ""
        ffmpeg_inputs = []
        
        output_filename = f"processed_{local_filename}"
        output_path = os.path.join(job_dir, output_filename)

        if mode == 'upload':
            # Check Overlay
            overlay_source = os.path.join(job_dir, "header_overlay.png")
            if not os.path.exists(overlay_source):
                print("Header overlay missing")
                continue
                
            # Determine Geometry
            final_y = 0
            if auto_detect:
                 # Auto-Height for Upload Mode? Just use detected header height.
                 detected_y, detected_h, _ = detect_header_height(input_path, height)
                 final_y = detected_y
                 target_h = detected_h
            else:
                 # Fallback default
                 target_h = int(height * 0.15)
            
            # Simple Crop & Scale of the uploaded image
            filter_complex = (
                f"[1:v]scale={width}:{target_h}:force_original_aspect_ratio=increase,"
                f"crop={width}:{target_h}[header];"
                f"[0:v][header]overlay=0:{final_y}:shortest=1"
            )
            ffmpeg_inputs = ['-i', overlay_source]

        else: # DESIGN Mode
            try:
                layout_override = None
                
                # Default / Fallback (if Auto is OFF)
                final_y = 0
                target_h = int(height * 0.15) # Default 15%
                content_padding = int(width * 0.04)
                
                if auto_detect:
                    show_headline_raw = config.get('showHeadline', True)
                    show_headline = str(show_headline_raw).lower() == 'true'
                    detected_y, detected_h, detected_padding = detect_header_height(input_path, height, show_headline=show_headline)
                    
                    # LOGIC: 
                    # 1. We MUST cover the detected original header (detected_h).
                    # 2. We MUST fit our new design content.
                    
                    # Calculate Design Content Height requirements
                    # (This is rough duplication of logic inside generate_design_overlay, but safest way)
                    scale_factor = width / 380.0
                    logo_percent = config.get('logoSize', 15)
                    logo_size_px = int(width * (logo_percent / 100.0))
                    name_fs = int(config.get('nameFontSize', 18) * scale_factor)
                    handle_fs = int(config.get('handleFontSize', 14) * scale_factor)
                    headline_fs = int(config.get('headlineFontSize', 24) * scale_factor)
                    padding = int(width * 0.04)
                    
                    # Height needed for Logo + Name row
                    row1_h = max(logo_size_px, int(name_fs * 1.2) + int(handle_fs * 1.2))
                    
                    # Height needed for Headline
                    show_headline_raw = config.get('showHeadline', True)
                    show_headline = str(show_headline_raw).lower() == 'true'
                    text_h = 0
                    if show_headline:
                        # Account for both manual and AI modes in height calculation
                        headline_mode = config.get('headlineMode', 'manual')
                        h_text = config.get('manualHeadline', "") if headline_mode == 'manual' else (reel.get('generated_headline') or "AI Headline Pending...")
                        
                        if h_text:
                             avg_char_width = headline_fs * 0.5
                             max_chars = int((width - (padding * 2)) / avg_char_width)
                    # Exact layout math from generate_design_overlay:
                    # pad_v = 12*scale
                    # gap = 8*scale
                    
                    pad_v = int(12 * scale_factor)
                    gap_v = int(8 * scale_factor)
                    
                    if text_h > 0:
                        # Top Pad + Logo + Middle Pad + Gap + Text + Bottom Pad
                        extra_space = (pad_v * 3) + gap_v
                    else:
                        # Top Pad + Logo + Bottom Pad
                        extra_space = (pad_v * 2)
                        
                    design_min_h = row1_h + text_h + extra_space

                    # The Final Height of the Black Bar
                    # Must be at least detected_h (to cover old) and at least design_min_h (to fit new)
                    final_h = max(detected_h, design_min_h)
                    
                    # Cap at 35% to be safe? Or trust the inputs?
                    # User asked for "Dependent on header size", so trust max.
                    
                    print(f"Auto-Height: Detected Old={detected_h}px, Needed New={int(design_min_h)}px -> Final={int(final_h)}px")

                    final_y = detected_y
                    target_h = int(final_h)
                    content_padding = detected_padding # Use the tight padding from detector

                # APPLY VERTICAL CORRECTION (Global Shift)
                final_y += vertical_correction
                
                # Ensure we don't go off-screen (optional, but good safety)
                # if final_y < 0: final_y = 0 # Allow negative if user wants to push it up? Maybe.

                # Save computed layout to DB for Frontend Preview
                reel['layout'] = {
                    'y': int(final_y),
                    'h': int(target_h),
                    'correction': vertical_correction,
                    'width': width,
                    'height': height
                }

                layout_override = (final_y, target_h, content_padding)
                    
                overlay_img = generate_design_overlay(job_dir, config, width, height, reel, base_dir, layout_override=layout_override)
                
                temp_overlay_path = os.path.join(job_dir, f"temp_overlay_{reel['id']}.png")
                overlay_img.save(temp_overlay_path)
                
                # Overlay is full frame? No, generate_design_overlay creates full frame image
                # So we just overlay at 0:0
                filter_complex = "[0:v][1:v]overlay=0:0:shortest=1"
                ffmpeg_inputs = ['-loop', '1', '-i', temp_overlay_path]
                
            except Exception as e:
                print(f"Design Generation Error: {e}")
                traceback.print_exc()
                continue
        
        print(f"Baking {local_filename}...")
        
        cmd = [
            'ffmpeg', '-y', 
            '-i', input_path,
            *ffmpeg_inputs,
            '-filter_complex', filter_complex,
            '-c:a', 'copy',
            '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
             output_path
        ]
        
        try:
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            print(f"Saved {output_filename}")
            
            if temp_overlay_path and os.path.exists(temp_overlay_path):
                os.remove(temp_overlay_path)

            reel['processed_path'] = output_filename
            processed_count += 1
            
            # Save incrementally
            # Atomic Write
            temp_file = f"{jobs_file}.tmp.{os.getpid()}"
            with open(temp_file, 'w') as f:
                json.dump(db, f, indent=2)
            os.replace(temp_file, jobs_file)
                
        except subprocess.CalledProcessError as e:
            print(f"FFmpeg failed: {e.stderr.decode()}")

    # Update Job Status (Global)
    job['status'] = 'completed'
    # Atomic Write
    temp_file = f"{jobs_file}.tmp.{os.getpid()}"
    with open(temp_file, 'w') as f:
        json.dump(db, f, indent=2)
    os.replace(temp_file, jobs_file)

    print(f"Batch processing complete. {processed_count} videos processed.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 process_batch.py <job_id>")
    else:
        process_batch(sys.argv[1])
