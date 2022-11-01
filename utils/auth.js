// authorization function
const withAuth = (req, res, next) => {
  // if there's no user_id stored in the session then redirect to login page
  if (!req.session.user_id) {
    res.redirect('/');
  } else {
    // otherwise run next function
    next();
  }
};
  
// export function
module.exports = withAuth;