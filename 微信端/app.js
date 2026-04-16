App({
  globalData: {
    userInfo: null,
    token: '',
    baseUrl: 'http://localhost:3000',
  },
  onLaunch() {
    const token = wx.getStorageSync('token');
    if (token) {
      this.globalData.token = token;
    }
  },
});
