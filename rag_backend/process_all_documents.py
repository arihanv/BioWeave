import os
import subprocess
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Document source directory
DOCS_SOURCE_DIR = r"C:\Users\madhu\Downloads\BioWeave RAG Docs-20250606T033155Z-1-001\BioWeave RAG Docs"

def process_category_folder(category_path, category_name):
    """Process all files in a category folder"""
    if not os.path.exists(category_path):
        logging.error(f"Category path does not exist: {category_path}")
        return
        
    logging.info(f"Processing category: {category_name}")
    
    # Get file count
    files = [f for f in os.listdir(category_path) if os.path.isfile(os.path.join(category_path, f))]
    logging.info(f"Found {len(files)} files in {category_name}")
    
    # Process the directory
    cmd = [
        "python", 
        "process_documents.py",
        "--directory", 
        category_path,
        "--category", 
        category_name
    ]
    
    try:
        logging.info(f"Running: {' '.join(cmd)}")
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        logging.info(f"Successfully processed {category_name}")
        logging.info(result.stdout)
    except subprocess.CalledProcessError as e:
        logging.error(f"Error processing {category_name}: {e}")
        logging.error(f"STDOUT: {e.stdout}")
        logging.error(f"STDERR: {e.stderr}")

def main():
    """Process all categories"""
    logging.info(f"Starting document processing from {DOCS_SOURCE_DIR}")
    
    # Check if the base directory exists
    if not os.path.exists(DOCS_SOURCE_DIR):
        logging.error(f"Source directory does not exist: {DOCS_SOURCE_DIR}")
        return
    
    # Process each category
    for category in os.listdir(DOCS_SOURCE_DIR):
        category_path = os.path.join(DOCS_SOURCE_DIR, category)
        if os.path.isdir(category_path):
            process_category_folder(category_path, category)
    
    logging.info("Finished processing all categories")

if __name__ == "__main__":
    main()
