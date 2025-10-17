import requests
from bs4 import BeautifulSoup
import json
import time

def get_and_parse_tester_status(url):
    """
    Fetches an HTML page from the given URL, scrapes the tester slot status,
    and returns the data in the specified JSON format.
    """
    all_slots_data = []
    print(f"\n---> Fetching data from: {url}")

    try:
        # Step 1: Make the GET request to the target server with proper headers
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, timeout=10, headers=headers)
        print(f"---  Status Code: {response.status_code}")

        # Proceed only if the request was successful (HTTP 200 OK)
        if response.status_code == 200:
            # Step 2: Parse the HTML content using BeautifulSoup
            soup = BeautifulSoup(response.content, "html.parser")

            # Get the station name (applies to all slots on the page)
            station_tag = soup.find("button", class_="fs-6")
            station_name = station_tag.text.strip() if station_tag else "Unknown Station"

            # Find the main container for all tester slots
            uut_list = soup.find("div", id="uutList")
            if not uut_list:
                print("---! Could not find the main 'uutList' container. The page structure may be different.")
                return []

            # Find all individual slot divs
            slot_divs = uut_list.find_all("div", id=lambda x: x and x.startswith('slot-'))
            print(f"---  Found {len(slot_divs)} slots to process.")

            # Step 3: Loop through each slot and extract its data
            for slot in slot_divs:
                slot_data = extract_slot_data(slot, station_name, url)
                if slot_data:
                    all_slots_data.append(slot_data)
        else:
            print(f"---! Received a non-200 status code. Cannot parse.")

    except requests.exceptions.RequestException as e:
        print(f"---! ERROR: Could not connect to the server. It may be offline.")
        print(f"   Details: {e}")
        # Create an error entry if the server is offline
        all_slots_data.append({
            "led": False, "result": "empty", "slot_name": "Offline",
            "sn": "", "station": "Offline", "test_time": "N/A", "url": url
        })

    return all_slots_data

def extract_slot_data(slot, station_name, url):
    """
    Extract data from a single slot element, aligned with JavaScript implementation
    """
    slot_id = slot.get('id', '')
    
    # Extract slot name from the chassisname link
    slot_name_tag = slot.find("span", {"class": "chassisname"})
    slot_name = ""
    if slot_name_tag:
        link = slot_name_tag.find('a')
        if link:
            slot_name = link.text.strip()
        else:
            slot_name = slot_name_tag.text.strip()
    
    # If no slot name found, try to extract from ID
    if not slot_name:
        import re
        id_match = re.search(r'slot-(\d+)', slot_id)
        if id_match:
            slot_num = id_match.group(1).zfill(2)
            slot_name = f"SLOT{slot_num}"
    
    # Extract slot status from CSS classes and chassisstatus element
    slot_status = "available"  # Default status
    
    # Check for status classes in order of priority
    status_classes = ['testing', 'failing', 'aborted', 'failed', 'passed', 'default']
    for status in status_classes:
        if slot.has_attr('class') and status in slot.get('class', []):
            slot_status = status
            break
    
    # Also try to extract status from the chassisstatus element
    chassis_status = slot.find("span", {"class": "chassisstatus"})
    if chassis_status and chassis_status.text.strip():
        chassis_status_text = chassis_status.text.strip().lower()
        if chassis_status_text:
            slot_status = chassis_status_text
    
    # Extract test time
    test_time_tag = slot.find("span", {"class": "testtime"})
    test_time = test_time_tag.text.strip() if test_time_tag and test_time_tag.text.strip() else "N/A"
    
    # Extract serial number from the first panel-body
    serial_number = "N/A"
    panel_body = slot.find("div", class_="panel-body")
    if panel_body:
        sn_tag = panel_body.find("span", class_="slot-sn")
        if sn_tag:
            link = sn_tag.find('a')
            if link:
                sn_text = link.text.strip()
                # Check if it looks like a serial number (numeric and longer than 6 digits)
                # Also handle serial numbers that might contain letters
                if sn_text and (len(sn_text) >= 7 or (len(sn_text) >= 6 and any(c.isdigit() for c in sn_text))):
                    # Exclude slot names like SLOT01, SLOT01_01
                    if not sn_text.startswith('SLOT'):
                        serial_number = sn_text
    
    # Extract sub-slots
    sub_slots = []
    all_panel_bodies = slot.find_all("div", class_="panel-body")
    for panel in all_panel_bodies:
        sn_tags = panel.find_all("span", class_="slot-sn")
        for sn_tag in sn_tags:
            link = sn_tag.find('a')
            if link:
                sub_slot_name = link.text.strip()
                sub_slot_style = link.get('style', '')
                
                # Only include sub-slots that have proper names
                if sub_slot_name and ('_' in sub_slot_name or sub_slot_name.startswith('SLOT')):
                    # Determine status from inline style color
                    sub_slot_status = 'active'
                    if '#AAA' in sub_slot_style or '#aaa' in sub_slot_style or 'rgb(170, 170, 170)' in sub_slot_style:
                        sub_slot_status = 'inactive'
                    
                    # Avoid duplicates and the main serial number
                    if not any(sub['name'] == sub_slot_name for sub in sub_slots) and sub_slot_name != serial_number:
                        sub_slots.append({
                            "name": sub_slot_name,
                            "status": sub_slot_status
                        })
    
    # Extract production info and software version from panel-footer
    production_info = "N/A"
    software_version = "N/A"
    
    panel_footer = slot.find("div", class_="panel-footer")
    if panel_footer:
        footer_texts = []
        fw_bold_tags = panel_footer.find_all("span", class_="slot-sn fw-bold")
        for tag in fw_bold_tags:
            text = tag.text.strip()
            if text:
                footer_texts.append(text)
        
        if len(footer_texts) >= 1:
            production_info = footer_texts[0]
        if len(footer_texts) >= 2:
            software_version = footer_texts[1]
    
    # Determine if slot is active based on status
    is_active = slot_status not in ['available', 'empty', '']
    
    # Assemble the data into the desired dictionary format
    return {
        "id": slot_id,
        "name": slot_name,
        "status": slot_status,
        "testTime": test_time,
        "serialNumber": serial_number,
        "subSlots": sub_slots,
        "productionInfo": production_info,
        "softwareVersion": software_version,
        "led": False,  # No LED indicator found in the new HTML, defaulting to False
        "result": slot_status if is_active else "empty",
        "slot_name": slot_name,
        "sn": serial_number,
        "station": station_name,
        "test_time": test_time,
        "url": url
    }

# This part of the script runs when you execute it directly
if __name__ == "__main__":
        
    # Get the target IP and Port from the user
    target_ip = input("Enter the IP address of the target server: ")
    target_port = input("Enter the port number (e.g., 8080): ")

    # Construct the full URL
    full_url = f"http://{target_ip}:{target_port}"
    
    print("\n" + "="*50)
    print("DEBUGGING FETCH_STATUS.PY")
    print("="*50)

    # Call the main function to get the data
    scraped_data = get_and_parse_tester_status(full_url)
    
    # Debug information
    print(f"\n---> Total slots processed: {len(scraped_data)}")
    
    # Count different statuses
    status_counts = {}
    for slot in scraped_data:
        status = slot.get('status', 'unknown')
        status_counts[status] = status_counts.get(status, 0) + 1
    
    print("---> Status distribution:")
    for status, count in status_counts.items():
        print(f"     {status}: {count}")
    
    # Show sample of first slot data
    if scraped_data:
        print("\n---> Sample slot data (first slot):")
        print(json.dumps(scraped_data[0], indent=2))

    # Step 5: Print the final JSON output
    print("\n---> Final JSON Output:")
    print(json.dumps(scraped_data, indent=2))