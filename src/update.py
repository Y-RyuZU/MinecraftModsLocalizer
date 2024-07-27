from init import USER, REPO, VERSION
import requests


def get_latest_release_tag(user, repo):
    """
    GitHubのリリースから最新のタグ名を取得する関数
    """
    url = f"https://api.github.com/repos/{user}/{repo}/releases/latest"
    response = requests.get(url)
    if response.status_code == 200:
        return response.json()['tag_name']
    else:
        print(f"Error {response.status_code}: {response.text}")
        return None


def check_version():
    """
    定数VERSIONとGitHubの最新リリースのタグを比較する関数
    """
    latest_tag = get_latest_release_tag(USER, REPO)
    if latest_tag:
        if VERSION == latest_tag:
            return True
        else:
            return False
