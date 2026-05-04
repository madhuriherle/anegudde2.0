import json
import sys

def update_collection(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Function to recursively find and update List requests
    def update_item(item_node):
        if 'item' in item_node:
            for child in item_node['item']:
                update_item(child)
        else:
            name = item_node.get('name', '')
            if name.startswith('List '):
                request = item_node.get('request', {})
                url = request.get('url', {})
                if 'raw' in url:
                    raw_url = url['raw']
                    if '?' not in raw_url:
                        raw_url += '?page=1&page_size=20&q=&search_field='
                    else:
                        if 'search_field' not in raw_url:
                            raw_url += '&search_field='
                    url['raw'] = raw_url

                if 'query' not in url:
                    url['query'] = []
                
                # Add query parameters if missing
                existing_keys = [q['key'] for q in url.get('query', [])]
                for key in ['page', 'page_size', 'q', 'search_field']:
                    if key not in existing_keys:
                        val = '1' if key == 'page' else '20' if key == 'page_size' else ''
                        url['query'].append({'key': key, 'value': val})

    for folder in data.get('item', []):
        update_item(folder)

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    print(f"Updated {filepath}")

if __name__ == "__main__":
    update_collection("D:\\python_project\\AneguddeTemple\\backend\\03-05-26_anegudde.postman_collection.json")
    update_collection("D:\\python_project\\AneguddeTemple\\backend\\03-05-26_anegudde_oneline.postman_collection.json")
