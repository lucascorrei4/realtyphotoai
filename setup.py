from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

with open("requirements.txt", "r", encoding="utf-8") as fh:
    requirements = [line.strip() for line in fh if line.strip() and not line.startswith("#")]

setup(
    name="realty-photo-ai",
    version="1.0.0",
    author="Real Estate AI Team",
    author_email="contact@realtyphotoai.com",
    description="Ultra-Realistic Real Estate Graphic Designer Agent",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/yourusername/realtyphotoai",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Intended Audience :: Real Estate",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "Topic :: Scientific/Engineering :: Image Recognition",
        "Topic :: Multimedia :: Graphics",
    ],
    python_requires=">=3.8",
    install_requires=requirements,
    entry_points={
        "console_scripts": [
            "realty-photo-ai=cli:main",
        ],
    },
    keywords="real estate, AI, image analysis, interior design, computer vision",
    project_urls={
        "Bug Reports": "https://github.com/yourusername/realtyphotoai/issues",
        "Source": "https://github.com/yourusername/realtyphotoai",
        "Documentation": "https://github.com/yourusername/realtyphotoai#readme",
    },
)