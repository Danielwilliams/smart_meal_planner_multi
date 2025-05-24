import re

# Find the actual '}' for the try block
def find_closing_brace(content, start_index):
    brace_count = 1
    for i in range(start_index, len(content)):
        if content[i] == '{':
            brace_count += 1
        elif content[i] == '}':
            brace_count -= 1
            if brace_count == 0:
                return i
    return -1

# Main patch function
def patch_file(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Find the parsing functions we need to modify
    parse_start = content.find('# Parse the JSON response with enhanced error handling')
    if parse_start == -1:
        print("Could not find the parse function")
        return
    
    try_start = content.find('try:', parse_start)
    if try_start == -1:
        print("Could not find the try block")
        return
    
    # Find where to replace through
    replacement_text = '''        # We moved the parsing to our earlier code block
        # This block is no longer needed since we directly return the array
        # from our earlier parsing
        return {
            "groceryList": [{"category": "All Items", "items": [{"name": item} for item in grocery_items]}],
            "recommendations": ["AI enhancement failed - showing basic list"],
            "error": "Should not reach this code - fallback response",
            "status": "error"
        }'''
    
    # Find some unique text after the try block
    auto_categorize_text = 'auto_categorize_items('
    auto_idx = content.find(auto_categorize_text, try_start)
    if auto_idx == -1:
        print("Could not find unique marker text")
        return
    
    # Go back to find the start of the section containing auto_categorize
    section_start = content.rfind('\n\n', try_start, auto_idx)
    if section_start == -1:
        section_start = try_start
    
    # Find end of the try-except block
    except_idx = content.find('except Exception as parse_error:', try_start)
    if except_idx == -1:
        print("Could not find exception handling")
        return
    
    # Find the end of the except block using regex
    parse_error_end_match = re.search(r'return\s*\{[^}]*\}\s*\}', content[except_idx:])
    if not parse_error_end_match:
        print("Could not find end of except block")
        return
    
    # Calculate the end position
    parse_error_end = except_idx + parse_error_end_match.end()
    
    # Create new content with the replacement
    new_content = content[:try_start] + replacement_text + content[parse_error_end:]
    
    # Write the patched file
    with open(file_path, 'w') as f:
        f.write(new_content)
    
    print(f"Patched {file_path} successfully")

# Patch the grocery_list.py file
patch_file('./app/routers/grocery_list.py')
