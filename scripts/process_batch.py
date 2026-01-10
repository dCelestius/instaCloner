import sys
import json
import os
import subprocess
import textwrap
try:
    from PIL import Image, ImageDraw, ImageFont, ImageOps
except ImportError:
    print("Pillow not installed. Creating without it (will fail for design mode).")

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

def create_circular_logo(logo_path, size):
    try:
        img = Image.open(logo_path).convert("RGBA")
        img = ImageOps.fit(img, size, centering=(0.5, 0.5))
        
        # Create mask
        mask = Image.new('L', size, 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0, size[0], size[1]), fill=255)
        
        # Apply mask
        output = Image.new('RGBA', size, (0, 0, 0, 0))
        output.paste(img, (0, 0), mask)
        
        # Add white border
        border_thickness = max(2, int(size[0] * 0.05))
        draw_overlay = ImageDraw.Draw(output)
        draw_overlay.ellipse((0, 0, size[0]-1, size[1]-1), outline="white", width=border_thickness)
        
        return output
    except Exception as e:
        print(f"Error processing logo: {e}")
        return Image.new('RGBA', size, (100, 100, 100, 255))

def get_font(size, bold=False):
    # Try to load a nice font on Mac
    font_names = [
        "Arial Bold.ttf" if bold else "Arial.ttf",
        "Helvetica-Bold" if bold else "Helvetica",
        "/System/Library/Fonts/Supplemental/Arial.ttf"
    ]
    
    for name in font_names:
        try:
            return ImageFont.truetype(name, size)
        except:
            continue
            
    # Fallback
    try:
        return ImageFont.load_default() 
    except:
        return None

def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4)) + (255,)

def generate_design_overlay(job_dir, config, width, height, reel_data, base_dir):
    """
    Generates a transparency overlay with the design elements.
    """
    # Create full transparent canvas
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Config
    vertical_percent = config.get('verticalPosition', 5)
    bg_color_hex = config.get('designBgColor', '#000000')
    try:
        bg_color = hex_to_rgb(bg_color_hex)
    except:
        bg_color = (0, 0, 0, 255)

    # Layout Calculations (Config driven)
    
    # 1. Base Dimensions relative to video width for scaling consistency if needed, 
    # but we will try to respect the strict sizes passed if they are meant to be relative to a standard ref?
    # Actually, standardizing: The React preview assumes standard px sizes on a small screen. 
    # But video is 1080p. 
    # We should interpret the input "size" integer as a PERCENTAGE of width or scale appropriately.
    # However, user slider says "10" to "40". 
    # Let's treat these as roughly "Scale Factors". 
    # 12 -> 12% of width is reasonable for Logo.
    # 18 -> 1.8% of width for text? No, that's too small.
    # Let's map them: 
    # Logo: size is % of width (e.g. 12 = 12%)
    # Font Sizes: size is px on a reference width of say 400px (phone screen).
    # So for 1080p video, we multiply by (1080/400) = 2.7.
    
    scale_factor = width / 380.0 # 380 is approx width of preview panel
    
    logo_percent = config.get('logoSize', 12)
    logo_size_px = int(width * (logo_percent / 100.0))
    
    name_fs_base = config.get('nameFontSize', 18)
    name_fs = int(name_fs_base * scale_factor)
    name_color = config.get('nameColor', '#ffffff')
    
    badge_size_base = config.get('badgeSize', 18)
    badge_size_px = int(badge_size_base * scale_factor)
    
    handle_fs_base = config.get('handleFontSize', 14)
    handle_fs = int(handle_fs_base * scale_factor)
    handle_color = config.get('handleColor', '#94a3b8')
    
    headline_fs_base = config.get('headlineFontSize', 32)
    headline_fs = int(headline_fs_base * scale_factor)
    headline_color = config.get('headlineColor', '#ffffff')
    
    # Padding
    padding = int(width * 0.04) 
    
    # Content block y position
    start_y = int(height * (vertical_percent / 100.0))
    
    # Calculate Text Height
    headline_mode = config.get('headlineMode', 'manual')
    headline_text = config.get('manualHeadline', "") if headline_mode == 'manual' else (reel_data.get('generated_headline') or "AI Headline Pending...")
    
    text_height = 0
    if headline_text:
        avg_char_width = headline_fs * 0.5
        max_chars = int((width - (padding * 2)) / avg_char_width)
        lines = textwrap.wrap(headline_text, width=max_chars)
        text_height = len(lines) * int(headline_fs * 1.3) + int(padding * 0.8)

    # Total block height
    # Logo row height + Headline height + Padding
    row1_height = max(logo_size_px, int(name_fs * 1.2) + int(handle_fs * 1.2))
    block_height = row1_height + text_height + (padding * 2) 
    
    # Draw Background
    draw.rectangle(
        [(0, start_y), (width, start_y + block_height)], 
        fill=bg_color
    )
    
    # Draw Content
    # Logo
    logo_size = (logo_size_px, logo_size_px)
    logo_x = padding
    logo_y = start_y + padding
    
    if os.path.join(job_dir, "logo.png") and os.path.exists(os.path.join(job_dir, "logo.png")):
        logo_img = create_circular_logo(os.path.join(job_dir, "logo.png"), logo_size)
        img.paste(logo_img, (logo_x, logo_y), logo_img)
    else:
         draw.ellipse((logo_x, logo_y, logo_x + logo_size_px, logo_y + logo_size_px), fill=(50, 50, 50), outline="white")

    # Name
    name_text = config.get('designName', 'User')
    font_bold = get_font(name_fs, bold=True)
    
    name_x = logo_x + logo_size_px + int(padding * 0.5)
    name_y = logo_y # Align top with logo roughly
    
    draw.text((name_x, name_y), name_text, font=font_bold, fill=name_color)
    
    # Badge
    badge_path = os.path.join(base_dir, "Twitter_Verified_Badge_Gold.svg.png")
    if os.path.exists(badge_path):
        name_bbox = draw.textbbox((name_x, name_y), name_text, font=font_bold)
        name_w = name_bbox[2] - name_bbox[0]
        
        b_size = (badge_size_px, badge_size_px)
        try:
            badge_img = Image.open(badge_path).convert("RGBA")
            badge_img = ImageOps.fit(badge_img, b_size, centering=(0.5, 0.5))
            badge_x = name_x + name_w + int(padding * 0.2)
            # Center vertically with text?
            badge_y_pos = name_y + (name_fs // 2) - (badge_size_px // 2)
            img.paste(badge_img, (badge_x, badge_y_pos), badge_img)
        except Exception as e:
            pass

    # Handle
    handle_text = config.get('designHandle', '')
    if handle_text:
        if not handle_text.startswith('@'):
            handle_text = f"@{handle_text}" 
        
        font_reg = get_font(handle_fs, bold=False)
        handle_y = name_y + name_fs + int(padding * 0.1)
        draw.text((name_x, handle_y), handle_text, font=font_reg, fill=handle_color)

    # Headline
    if headline_text:
        font_head = get_font(headline_fs, bold=False)
        text_x = padding
        text_y = logo_y + logo_size_px + int(padding * 0.5)
        
        avg_char_width = headline_fs * 0.5
        max_chars = int((width - (padding * 2)) / avg_char_width)
        lines = textwrap.wrap(headline_text, width=max_chars)
        
        for line in lines:
            draw.text((text_x, text_y), line, font=font_head, fill=headline_color)
            text_y += int(headline_fs * 1.3)
            
    return img
    
    if headline_mode == 'manual':
        headline_text = config.get('manualHeadline', "")
    else:
        # AI Mode - Placeholder for now
        # Check if we have generated title in reel_data?
        headline_text = reel_data.get('generated_headline') or "AI Headline Generation Pending..."
        
    if headline_text:
        headline_font_size = int(width * 0.05) # 5% of width
        font_reg = get_font(headline_font_size, bold=False)
        
        text_x = padding
        # Start text below logo + some gap
        text_y = logo_y + logo_size_px + int(padding * 0.8)
        
        # Wrap text
        # Approx chars per line?
        avg_char_width = headline_font_size * 0.6
        max_chars = int((width - (padding * 2)) / avg_char_width)
        
        lines = textwrap.wrap(headline_text, width=max_chars)
        
        for line in lines:
            draw.text((text_x, text_y), line, font=font_reg, fill="white")
            text_y += int(headline_font_size * 1.3)
            
    return img

def process_batch(job_id):
    # Paths
    base_dir = os.getcwd()
    jobs_file = os.path.join(base_dir, "data", "jobs.json")
    job_dir = os.path.join(base_dir, "public", "downloads", job_id)
    
    if not os.path.exists(jobs_file):
        print("jobs.json not found")
        return

    with open(jobs_file, 'r') as f:
        db = json.load(f)

    job = db.get(job_id)
    if not job:
        print(f"Job {job_id} not found")
        return

    config = job.get('config', {})
    mode = config.get('mode', 'upload')
    header_height_percent = config.get('headerHeight', 15)

    print(f"Processing Job {job_id} | Mode: {mode} | Height: {header_height_percent}%")

    reels = job.get('reels', [])
    processed_count = 0

    for reel in reels:
        if reel.get('status') != 'approved':
            continue

        local_filename = reel.get('local_video_path')
        if not local_filename:
            print(f"Skipping {reel['id']} - no local file")
            continue
            
        input_path = os.path.join(job_dir, local_filename)
        output_filename = f"processed_{local_filename}"
        output_path = os.path.join(job_dir, output_filename)

        if not os.path.exists(input_path):
            print(f"Input file missing: {input_path}")
            continue

        dims = get_video_dimensions(input_path)
        if not dims:
            continue
            
        width, height = dims
        target_h = int(height * (header_height_percent / 100.0))
        target_w = width

        # Determine overlay image
        temp_overlay_path = None
        
        if mode == 'upload':
            # Use static uploaded image
            overlay_source = os.path.join(job_dir, "header_overlay.png")
            if not os.path.exists(overlay_source):
                print("Header overlay missing for upload mode")
                continue
                
            # Filter complex for static image
            filter_complex = (
                f"[1:v]scale={target_w}:{target_h}:force_original_aspect_ratio=increase,"
                f"crop={target_w}:{target_h}[header];"
                f"[0:v][header]overlay=0:0"
            )
            ffmpeg_inputs = ['-i', overlay_source]
            
        else: # Design Mode
            try:
                # Generate unique overlay for this video resolution
                overlay_img = generate_design_overlay(job_dir, config, width, target_h, reel, base_dir)
                temp_overlay_path = os.path.join(job_dir, f"temp_overlay_{reel['id']}.png")
                overlay_img.save(temp_overlay_path)
                
                # For design mode, the generated image is EXACTLY target_w x target_h
                # So no scaling needed, just overlay
                filter_complex = f"[0:v][1:v]overlay=0:0"
                ffmpeg_inputs = ['-i', temp_overlay_path]
                
            except Exception as e:
                print(f"Failed to generate design overlay: {e}")
                continue

        print(f"Processing {local_filename} -> Overlay {target_w}x{target_h}")

        cmd = [
            'ffmpeg',
            '-y', 
            '-i', input_path,
            *ffmpeg_inputs,
            '-filter_complex', filter_complex,
            '-c:a', 'copy', 
            output_path
        ]

        try:
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            print(f"Saved {output_filename}")
            
            # Clean up temp overlay
            if temp_overlay_path and os.path.exists(temp_overlay_path):
                os.remove(temp_overlay_path)

            reel['processed_path'] = output_filename
            processed_count += 1
            
        except subprocess.CalledProcessError as e:
            print(f"FFmpeg failed for {local_filename}: {e.stderr.decode()}")

    # Update Job Status
    job['status'] = 'completed'
    
    with open(jobs_file, 'w') as f:
        json.dump(db, f, indent=2)

    print(f"Batch processing complete. {processed_count} videos processed.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 process_batch.py <job_id>")
    else:
        process_batch(sys.argv[1])
