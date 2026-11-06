// Generated from Joomla reference 52559589cb6a02c9e2fc48270f92b3aff7b8b7a0. GPL-2.0-or-later; (C) Open Source Matters.
export const JOOMLA_BLOG_DATA = {
  "schemaVersion": 1,
  "id": "joomla-blog",
  "version": 1,
  "title": "Joomla Blog Sample Data",
  "source": {
    "revision": "52559589cb6a02c9e2fc48270f92b3aff7b8b7a0",
    "copyright": "(C) 2017 Open Source Matters, Inc.",
    "license": "GPL-2.0-or-later",
    "references": [
      "plugins/sampledata/blog/src/Extension/Blog.php",
      "administrator/language/en-GB/plg_sampledata_blog.ini",
      "installation/sql/mysql/base.sql"
    ]
  },
  "domains": {
    "categories": [
      {
        "key": "blog",
        "values": {
          "title": "Blog",
          "alias": "blog",
          "description": "",
          "state": "Published"
        },
        "parentRef": null
      },
      {
        "key": "help",
        "values": {
          "title": "Help",
          "alias": "help",
          "description": "",
          "state": "Published"
        },
        "parentRef": null
      },
      {
        "key": "joomla",
        "values": {
          "title": "Joomla",
          "alias": "joomla",
          "description": "",
          "state": "Published"
        },
        "parentRef": null
      },
      {
        "key": "typography",
        "values": {
          "title": "Typography",
          "alias": "typography",
          "description": "",
          "state": "Published"
        },
        "parentRef": null
      }
    ],
    "tags": [
      {
        "key": "millions",
        "values": {
          "name": "Millions",
          "alias": "millions",
          "state": "Published",
          "description": ""
        },
        "parentRef": null
      },
      {
        "key": "worldwide",
        "values": {
          "name": "Worldwide",
          "alias": "worldwide",
          "state": "Published",
          "description": ""
        },
        "parentRef": null
      },
      {
        "key": "love",
        "values": {
          "name": "Love",
          "alias": "love",
          "state": "Published",
          "description": ""
        },
        "parentRef": null
      },
      {
        "key": "joomla-6",
        "values": {
          "name": "Joomla 6",
          "alias": "joomla-6",
          "state": "Published",
          "description": ""
        },
        "parentRef": "love"
      }
    ],
    "articles": [
      {
        "key": "about",
        "values": {
          "title": "About",
          "alias": "about",
          "introtext": "<p>This tells you a bit about this blog and the person who writes it.</p><p>When you are logged in you will be able to edit this page by selecting the edit icon.</p>",
          "fulltext": "",
          "state": "Published",
          "featured": false,
          "publishUp": "2026-11-06T00:00:00.000Z",
          "publishDown": null,
          "author": "Joomla sample data",
          "authorAlias": "Joomla sample data",
          "language": "*",
          "note": "",
          "versionNote": "",
          "featuredUp": null,
          "featuredDown": null,
          "metaDescription": "",
          "metaKeywords": "",
          "attribsJson": "{\"images\":{}}"
        },
        "categoryRef": "help",
        "tagRefs": []
      },
      {
        "key": "working-on-your-site",
        "values": {
          "title": "Working on Your Site",
          "alias": "working-on-your-site",
          "introtext": "<p>Here are some basic tips for working on your site.</p><ul><li>Joomla! has a 'front end' that you are looking at now and an 'administrator' or 'back end' which is where you do the more advanced work of creating your site such as setting up the menus and deciding what modules to show. You need to login to the administrator separately using the same user name and password that you used to login to this part of the site.</li><li>One of the first things you will probably want to do is change the site title and tag line and to add a logo. To do this select the Template Settings link in the menu which is visible if you log in. To change your site description, browser title, default email and other items, select Site Settings. More advanced configuration options are available in the administrator.</li><li>To totally change the look of your site you will probably want to install a new template. Go to System, select Install - Extensions from the list and the extension installer will open. There are many free and commercial templates available for Joomla.</li><li>As you have already seen, you can control who can see different parts of you site. When you work with modules and articles, setting the Access level to Registered will mean that only logged in users can see them.</li><li>When you create a new article or other kind of content you also can save it as Published or Unpublished. If it is Unpublished site visitors will not be able to see it but you will.</li><li>You can learn much more about working with Joomla from the <a href=\"https://guide.joomla.org/\" target=\"_blank\" rel=\"noopener noreferrer\">Joomla documentation site</a> and get help from other users at the <a href=\"https://forum.joomla.org/\" target=\"_blank\" rel=\"noopener noreferrer\">Joomla forums</a>. In the administrator there are help buttons on every page that provide detailed information about the functions on that page.</li></ul>",
          "fulltext": "",
          "state": "Published",
          "featured": false,
          "publishUp": "2026-11-06T00:00:00.000Z",
          "publishDown": null,
          "author": "Joomla sample data",
          "authorAlias": "Joomla sample data",
          "language": "*",
          "note": "",
          "versionNote": "",
          "featuredUp": null,
          "featuredDown": null,
          "metaDescription": "",
          "metaKeywords": "",
          "attribsJson": "{\"images\":{}}"
        },
        "categoryRef": "help",
        "tagRefs": []
      },
      {
        "key": "welcome-to-your-blog",
        "values": {
          "title": "Welcome to your blog",
          "alias": "welcome-to-your-blog",
          "introtext": "<p>This is a sample blog posting.</p><p>If you log in to the site (the Administrator Login link is on the very bottom of this page) you will be able to edit it and all of the other existing articles. You will also be able to create a new article and make other changes to the site.</p><p>As you add and modify articles you will see how your site changes and also how you can customise it in various ways.</p><p>Go ahead, you can't break it.</p>",
          "fulltext": "",
          "state": "Published",
          "featured": true,
          "publishUp": "2026-11-06T00:00:00.000Z",
          "publishDown": null,
          "author": "Joomla sample data",
          "authorAlias": "Joomla sample data",
          "language": "*",
          "note": "",
          "versionNote": "",
          "featuredUp": null,
          "featuredDown": null,
          "metaDescription": "",
          "metaKeywords": "",
          "attribsJson": "{\"images\":{\"image_intro\":\"__SAMPLE_MEDIA_BASE__/images/sampledata/cassiopeia/nasa1-1200.jpg\",\"image_intro_alt\":\"Amazing Andromeda Galaxy\",\"image_intro_caption\":\"\",\"float_intro\":\"\",\"image_fulltext\":\"__SAMPLE_MEDIA_BASE__/images/sampledata/cassiopeia/nasa1-400.jpg\",\"image_fulltext_alt\":\"\",\"image_fulltext_caption\":\"www.nasa.gov/multimedia/imagegallery\",\"float_fulltext\":\"float-start\"}}"
        },
        "categoryRef": "blog",
        "tagRefs": [
          "millions",
          "worldwide",
          "love",
          "joomla-6"
        ]
      },
      {
        "key": "about-your-home-page",
        "values": {
          "title": "About your home page",
          "alias": "about-your-home-page",
          "introtext": "<p>Your home page is set to display the four most recent articles from the blog category in a column. Then there are links to the next two oldest articles. You can change those numbers by editing the content options settings in the blog tab in your site administrator. There is a link to your site administrator if you are logged in.</p><p>If you want to have your blog post broken into two parts, an introduction and then a full length separate page, use the Read More span to insert a break.</p>",
          "fulltext": "<p>On the full page you will see both the introductory content and the rest of the article. You can change the settings to hide the introduction if you want.</p>",
          "state": "Published",
          "featured": true,
          "publishUp": "2026-11-06T00:00:00.000Z",
          "publishDown": null,
          "author": "Joomla sample data",
          "authorAlias": "Joomla sample data",
          "language": "*",
          "note": "",
          "versionNote": "",
          "featuredUp": null,
          "featuredDown": null,
          "metaDescription": "",
          "metaKeywords": "",
          "attribsJson": "{\"images\":{\"image_intro\":\"__SAMPLE_MEDIA_BASE__/images/sampledata/cassiopeia/nasa2-1200.jpg\",\"image_intro_alt\":\"\",\"image_intro_caption\":\"\",\"float_intro\":\"\",\"image_fulltext\":\"__SAMPLE_MEDIA_BASE__/images/sampledata/cassiopeia/nasa2-400.jpg\",\"image_fulltext_alt\":\"\",\"image_fulltext_caption\":\"www.nasa.gov/multimedia/imagegallery\",\"float_fulltext\":\"float-start\"}}"
        },
        "categoryRef": "blog",
        "tagRefs": [
          "millions",
          "worldwide",
          "love",
          "joomla-6"
        ]
      },
      {
        "key": "your-modules",
        "values": {
          "title": "Your Modules",
          "alias": "your-modules",
          "introtext": "<p>Your site has some commonly used modules already preconfigured. These include:</p><ul><li>Image (type: Custom), which holds the image beneath the menu. This is a Custom module that you can edit to change the image.</li><li>Popular Tags (type: Tags - Popular), which will appear if you use tagging on your articles. Enter a tag in the Tags field when editing.</li><li>Older Posts (type: Articles), which lists out articles by categories.</li><li>Syndication (type: Syndication Feeds), which allows your readers to read your posts in a news reader.</li><li>Login Form (type: Login), which allows your users to access restricted areas of the website.</li></ul><p>Each of these modules has many options which you can experiment with in the Module Manager in your site Administrator. When you are logged in you can also select the edit icon in the top right corner which will take you to an edit screen for that module. Always be sure to save and close any module you edit.</p><p>Joomla! also includes many other modules you can incorporate in your site. As you develop your site you may want to add more modules that you can find at the <a href=\"https://extensions.joomla.org/\" target=\"_blank\" rel=\"noopener noreferrer\">Joomla Extensions Directory.</a></p>",
          "fulltext": "",
          "state": "Published",
          "featured": true,
          "publishUp": "2026-11-06T00:00:00.000Z",
          "publishDown": null,
          "author": "Joomla sample data",
          "authorAlias": "Joomla sample data",
          "language": "*",
          "note": "",
          "versionNote": "",
          "featuredUp": null,
          "featuredDown": null,
          "metaDescription": "",
          "metaKeywords": "",
          "attribsJson": "{\"images\":{\"image_intro\":\"__SAMPLE_MEDIA_BASE__/images/sampledata/cassiopeia/nasa3-1200.jpg\",\"image_intro_alt\":\"\",\"image_intro_caption\":\"\",\"float_intro\":\"\",\"image_fulltext\":\"__SAMPLE_MEDIA_BASE__/images/sampledata/cassiopeia/nasa3-400.jpg\",\"image_fulltext_alt\":\"Crab Nebula\",\"image_fulltext_caption\":\"www.nasa.gov/multimedia/imagegallery\",\"float_fulltext\":\"float-start\"}}"
        },
        "categoryRef": "blog",
        "tagRefs": [
          "millions",
          "worldwide",
          "love",
          "joomla-6"
        ]
      },
      {
        "key": "your-template",
        "values": {
          "title": "Your Template",
          "alias": "your-template",
          "introtext": "<p>Templates control the look and feel of your website.</p><p>This blog is installed with the Cassiopeia template.</p><p>You can edit the options by selecting the Working on Your Site, Template Settings link in the menu which is visible when you log in.</p><p>For example you can change the site background colour, highlights colour, site title, site description and title font used.</p><p>More options are available in the site administrator. You may also install a new template using the extension manager.</p>",
          "fulltext": "",
          "state": "Published",
          "featured": true,
          "publishUp": "2026-11-06T00:00:00.000Z",
          "publishDown": null,
          "author": "Joomla sample data",
          "authorAlias": "Joomla sample data",
          "language": "*",
          "note": "",
          "versionNote": "",
          "featuredUp": null,
          "featuredDown": null,
          "metaDescription": "",
          "metaKeywords": "",
          "attribsJson": "{\"images\":{\"image_intro\":\"__SAMPLE_MEDIA_BASE__/images/sampledata/cassiopeia/nasa4-1200.jpg\",\"image_intro_alt\":\"\",\"image_intro_caption\":\"\",\"float_intro\":\"\",\"image_fulltext\":\"__SAMPLE_MEDIA_BASE__/images/sampledata/cassiopeia/nasa4-400.jpg\",\"image_fulltext_alt\":\"\",\"image_fulltext_caption\":\"www.nasa.gov/multimedia/imagegallery\",\"float_fulltext\":\"float-start\"}}"
        },
        "categoryRef": "blog",
        "tagRefs": [
          "millions",
          "worldwide",
          "love",
          "joomla-6"
        ]
      },
      {
        "key": "millions",
        "values": {
          "title": "Millions",
          "alias": "millions",
          "introtext": "<p><strong>Millions of Websites are built on Joomla!</strong></p><p>Learn more about beautiful blog presentation.</p>",
          "fulltext": "<p>Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est</p>",
          "state": "Published",
          "featured": false,
          "publishUp": "2026-11-06T00:00:00.000Z",
          "publishDown": null,
          "author": "Joomla sample data",
          "authorAlias": "Joomla sample data",
          "language": "*",
          "note": "",
          "versionNote": "",
          "featuredUp": null,
          "featuredDown": null,
          "metaDescription": "",
          "metaKeywords": "",
          "attribsJson": "{\"images\":{\"image_intro\":\"__SAMPLE_MEDIA_BASE__/images/sampledata/cassiopeia/nasa1-640.jpg\",\"image_intro_alt\":\"\",\"image_intro_caption\":\"\",\"float_intro\":\"\"}}"
        },
        "categoryRef": "joomla",
        "tagRefs": []
      },
      {
        "key": "love",
        "values": {
          "title": "Love",
          "alias": "love",
          "introtext": "<p><strong>We love Joomla to the moon and back!</strong></p><p>Thank you to all volunteers who have contributed!</p>",
          "fulltext": "<p>Uurnip greens yarrow ricebean rutabaga endive cauliflower sea lettuce kohlrabi amaranth water spinach avocado daikon napa cabbage asparagus winter purslane kale. Celery potato scallion desert raisin horseradish spinach carrot soko. Lotus root water spinach fennel kombu maize bamboo shoot green bean swiss chard seakale pumpkin onion chickpea gram corn pea. Brussels sprout coriander water chestnut gourd swiss chard wakame kohlrabi beetroot carrot watercress. Corn amaranth salsify bunya nuts nori azuki bean chickweed potato bell pepper artichoke.</p> ",
          "state": "Published",
          "featured": false,
          "publishUp": "2026-11-06T00:00:00.000Z",
          "publishDown": null,
          "author": "Joomla sample data",
          "authorAlias": "Joomla sample data",
          "language": "*",
          "note": "",
          "versionNote": "",
          "featuredUp": null,
          "featuredDown": null,
          "metaDescription": "",
          "metaKeywords": "",
          "attribsJson": "{\"images\":{\"image_intro\":\"__SAMPLE_MEDIA_BASE__/images/sampledata/cassiopeia/nasa2-640.jpg\",\"image_intro_alt\":\"\",\"image_intro_caption\":\"\",\"float_intro\":\"\"}}"
        },
        "categoryRef": "joomla",
        "tagRefs": []
      },
      {
        "key": "joomla",
        "values": {
          "title": "Joomla",
          "alias": "joomla",
          "introtext": "<p><strong>We proudly present Joomla Version 6!</strong></p><p>Learn more about workflows in Joomla.</p>",
          "fulltext": "<p>Cupcake ipsum dolor. Sit amet cotton candy ice cream sesame snaps cake marshmallow powder. Ice cream chocolate cake marshmallow halvah bonbon. Dragée carrot cake danish candy muffin brownie. Candy sugar plum ice cream chupa chups macaroon tiramisu soufflé oat cake. Topping cheesecake lollipop gummi bears icing sweet roll donut liquorice. Pie jelly-o candy donut oat cake cotton candy.</p>",
          "state": "Published",
          "featured": false,
          "publishUp": "2026-11-06T00:00:00.000Z",
          "publishDown": null,
          "author": "Joomla sample data",
          "authorAlias": "Joomla sample data",
          "language": "*",
          "note": "",
          "versionNote": "",
          "featuredUp": null,
          "featuredDown": null,
          "metaDescription": "",
          "metaKeywords": "",
          "attribsJson": "{\"images\":{\"image_intro\":\"__SAMPLE_MEDIA_BASE__/images/sampledata/cassiopeia/nasa3-640.jpg\",\"image_intro_alt\":\"\",\"image_intro_caption\":\"\",\"float_intro\":\"\"}}"
        },
        "categoryRef": "joomla",
        "tagRefs": []
      },
      {
        "key": "workflows",
        "values": {
          "title": "Workflows",
          "alias": "workflows",
          "introtext": "<p>Workflows manage the stages your articles must go through until they are published.</p><p>The component to manage workflows is not enabled by default.</p><p>To see the workflow that we have provided with the sample data, you first need to enable this functionality.</p><ol><li>Access the administration area</li><li>From 'Content' > 'Articles' > 'Options' > 'Integration' tab set 'Enable workflow' to 'Yes'</li><li>Save changes</li></ol><p>Now when you access 'Content' again you will see the section 'Workflows'.</p><p>When you edit an article you will also see the new transitions for articles related to workflows.</p>",
          "fulltext": "",
          "state": "Published",
          "featured": false,
          "publishUp": "2026-11-06T00:00:00.000Z",
          "publishDown": null,
          "author": "Joomla sample data",
          "authorAlias": "Joomla sample data",
          "language": "*",
          "note": "",
          "versionNote": "",
          "featuredUp": null,
          "featuredDown": null,
          "metaDescription": "",
          "metaKeywords": "",
          "attribsJson": "{\"images\":{\"image_fulltext\":\"__SAMPLE_MEDIA_BASE__/images/sampledata/cassiopeia/nasa4-400.jpg\",\"image_fulltext_alt\":\"\",\"image_fulltext_caption\":\"www.nasa.gov/multimedia/imagegallery\",\"float_fulltext\":\"float-end\"}}"
        },
        "categoryRef": "help",
        "tagRefs": []
      },
      {
        "key": "typography",
        "values": {
          "title": "Typography",
          "alias": "typography",
          "introtext": "<h1>Colour Scheme</h1> <p class=\"d-grid gap-2 d-sm-block\"> <span class=\"btn btn-secondary\">secondary</span>   <span class=\"btn btn-primary\">primary</span>   <span class=\"btn btn-info\">info</span>   <span class=\"btn btn-success\">success</span>   <span class=\"btn btn-warning\">warning</span>   <span class=\"btn btn-danger\">danger</span> </p> <p><span class=\"text text-secondary\">text-secondary</span>  <span class=\"text text-primary\">text-primary</span>  <span class=\"text text-info\">text-info</span>  <span class=\"text text-success\">text-success</span>  <span class=\"text text-warning\">text-warning</span>  <span class=\"text text-danger\">text-danger</span></p><h1>Typography (h1)</h1><p>Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat. Ut wisi enim ad minim veniam, quis nostrud exerci tation ullamcorper suscipit lobortis nisl ut aliquip ex. (p)</p><h2>Lorem Ipsum Dolor Sit Amet (h2)</h2><p><strong>Lorem ipsum dolor sit amet, consectetuer adipiscing elit </strong> (strong), sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat. Ut wisi enim ad minim veniam, quis nostrud exerci tation ullamcorper suscipit lobortis nisl ut aliquip ex. (p)</p><h3>Lorem Ipsum Dolor Sit Amet (h3)</h3><p>Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat. Ut wisi enim ad minim veniam, quis nostrud exerci tation ullamcorper suscipit lobortis nisl ut aliquip ex. (p)</p><h4>Lorem Ipsum Dolor Sit Amet (h4)</h4><p>Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat. Ut wisi enim ad minim veniam, quis nostrud exerci tation ullamcorper suscipit lobortis nisl ut aliquip ex. (p)</p><h5>Lorem Ipsum Dolor Sit Amet (h5)</h5><p>Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat. Ut wisi enim ad minim veniam, quis nostrud exerci tation ullamcorper suscipit lobortis nisl ut aliquip ex. (p)</p> <p><a href=\"#/\"> Lorem ipsum dolor (a)</a></p><h1>Lists</h1> <p>(ol)(li)</p> <ol> <li>Lorem ipsum dolor sit amet consectetur</li> <li>Lorem ipsum dolor sit amet consectetur</li> </ol> <p>(ul)(li)</p> <ul> <li>Lorem ipsum dolor sit amet consectetur</li> <li>Lorem ipsum dolor sit amet consectetur</li> </ul> <h1>Displays</h1><p class=\"display-1\">Lorem (display-1)</p><p class=\"display-2\">Lorem (display-2)</p><p class=\"display-3\">Lorem ipsum (display-3)</p><p class=\"display-4\">Lorem ipsum (display-4)</p><p class=\"lead\">Lorem ipsum arma virumque cano (lead)</p>",
          "fulltext": "",
          "state": "Published",
          "featured": false,
          "publishUp": "2026-11-06T00:00:00.000Z",
          "publishDown": null,
          "author": "Joomla sample data",
          "authorAlias": "Joomla sample data",
          "language": "*",
          "note": "",
          "versionNote": "",
          "featuredUp": null,
          "featuredDown": null,
          "metaDescription": "",
          "metaKeywords": "",
          "attribsJson": "{\"images\":{}}"
        },
        "categoryRef": "typography",
        "tagRefs": []
      }
    ],
    "menu": [
      {
        "key": "blog-home",
        "values": {
          "title": "Blog",
          "path": "/",
          "published": "Published",
          "ordering": 1
        },
        "parentRef": null
      },
      {
        "key": "about",
        "values": {
          "title": "About",
          "path": "/article/about",
          "published": "Published",
          "ordering": 2
        },
        "parentRef": null
      },
      {
        "key": "working-on-your-site",
        "values": {
          "title": "Working on Your Site",
          "path": "/category/help",
          "published": "Published",
          "ordering": 3
        },
        "parentRef": null
      },
      {
        "key": "sample-layouts",
        "values": {
          "title": "Sample Layouts",
          "path": "/categories",
          "published": "Published",
          "ordering": 4
        },
        "parentRef": null
      },
      {
        "key": "category-list",
        "values": {
          "title": "Category List",
          "path": "/category/blog?layout=list",
          "published": "Published",
          "ordering": 5
        },
        "parentRef": "sample-layouts"
      },
      {
        "key": "articles",
        "values": {
          "title": "Articles",
          "path": "/category/joomla",
          "published": "Published",
          "ordering": 6
        },
        "parentRef": "sample-layouts"
      },
      {
        "key": "typography",
        "values": {
          "title": "Typography",
          "path": "/article/typography",
          "published": "Published",
          "ordering": 7
        },
        "parentRef": null
      },
      {
        "key": "search",
        "values": {
          "title": "Search",
          "path": "/search",
          "published": "Published",
          "ordering": 8
        },
        "parentRef": null
      }
    ],
    "extensions": [
      {
        "key": "emailcloak",
        "values": {
          "title": "plg_content_emailcloak",
          "key": "emailcloak",
          "type": "Plugin",
          "entryPointUrl": "native:emailcloak",
          "enabled": true,
          "ordering": 3,
          "params": {
            "mode": "1"
          },
          "manifestJson": "{\"group\":\"content\",\"params\":[]}"
        }
      },
      {
        "key": "loadmodule",
        "values": {
          "title": "plg_content_loadmodule",
          "key": "loadmodule",
          "type": "Plugin",
          "entryPointUrl": "native:loadmodule",
          "enabled": true,
          "ordering": 7,
          "params": {
            "style": "xhtml"
          },
          "manifestJson": "{\"group\":\"content\",\"params\":[]}"
        }
      },
      {
        "key": "pagebreak",
        "values": {
          "title": "plg_content_pagebreak",
          "key": "pagebreak",
          "type": "Plugin",
          "entryPointUrl": "native:pagebreak",
          "enabled": true,
          "ordering": 8,
          "params": {
            "title": "1",
            "multipage_toc": "1",
            "showall": "1"
          },
          "manifestJson": "{\"group\":\"content\",\"params\":[]}"
        }
      },
      {
        "key": "pagenavigation",
        "values": {
          "title": "plg_content_pagenavigation",
          "key": "pagenavigation",
          "type": "Plugin",
          "entryPointUrl": "native:pagenavigation",
          "enabled": true,
          "ordering": 9,
          "params": {
            "position": "1"
          },
          "manifestJson": "{\"group\":\"content\",\"params\":[]}"
        }
      }
    ],
    "templates": [
      {
        "key": "cassiopeia",
        "values": {
          "title": "Cassiopeia",
          "key": "cassiopeia",
          "version": "0.8.0",
          "entryPointUrl": "__SAMPLE_RELEASE_BASE__/templates/cassiopeia/index.js",
          "styles": "",
          "positionsJson": "[\"topbar\",\"below-top\",\"menu\",\"search\",\"banner\",\"breadcrumbs\",\"top-a\",\"top-b\",\"main-top\",\"sidebar-left\",\"sidebar-right\",\"main-bottom\",\"bottom-a\",\"bottom-b\",\"footer\",\"component\"]",
          "enabled": true
        }
      }
    ],
    "moduleInstances": [
      {
        "key": "latest-posts",
        "values": {
          "title": "Latest Posts",
          "extensionKey": "articles",
          "position": "top-a",
          "ordering": 6,
          "settings": {
            "limit": 3,
            "category": "joomla",
            "ordering": "title",
            "showDate": false
          },
          "enabled": true,
          "showTitle": false,
          "scopeKind": "All",
          "scopeRoute": "",
          "scopeCategoryAlias": "",
          "trashed": false,
          "publishUp": "2026-11-06T00:00:00.000Z",
          "publishDown": null,
          "assignment": "only",
          "assignmentTokens": [
            "route:home"
          ],
          "note": ""
        }
      },
      {
        "key": "archive-months",
        "values": {
          "title": "Archived Articles",
          "extensionKey": "articles-archive",
          "position": "sidebar-right",
          "ordering": 4,
          "settings": {
            "limit": 10
          },
          "enabled": true,
          "showTitle": true,
          "scopeKind": "All",
          "scopeRoute": "",
          "scopeCategoryAlias": "",
          "trashed": false,
          "publishUp": "2026-11-06T00:00:00.000Z",
          "publishDown": null,
          "assignment": "all",
          "assignmentTokens": [],
          "note": ""
        }
      },
      {
        "key": "popular-tags",
        "values": {
          "title": "Popular Tags",
          "extensionKey": "tags-popular",
          "position": "bottom-b",
          "ordering": 1,
          "settings": {},
          "enabled": true,
          "showTitle": true,
          "scopeKind": "All",
          "scopeRoute": "",
          "scopeCategoryAlias": "",
          "trashed": false,
          "publishUp": "2026-11-06T00:00:00.000Z",
          "publishDown": null,
          "assignment": "all",
          "assignmentTokens": [],
          "note": ""
        }
      },
      {
        "key": "similar-items",
        "values": {
          "title": "Similar Items",
          "extensionKey": "related-items",
          "position": "bottom-b",
          "ordering": 0,
          "settings": {
            "limit": 5,
            "showDate": false
          },
          "enabled": true,
          "showTitle": true,
          "scopeKind": "All",
          "scopeRoute": "",
          "scopeCategoryAlias": "",
          "trashed": false,
          "publishUp": "2026-11-06T00:00:00.000Z",
          "publishDown": null,
          "assignment": "only",
          "assignmentTokens": [
            "route:article"
          ],
          "note": ""
        }
      },
      {
        "key": "search",
        "values": {
          "title": "Search",
          "extensionKey": "search",
          "position": "search",
          "ordering": 1,
          "settings": {
            "label": "Search",
            "buttonText": "Search"
          },
          "enabled": true,
          "showTitle": false,
          "scopeKind": "All",
          "scopeRoute": "",
          "scopeCategoryAlias": "",
          "trashed": false,
          "publishUp": "2026-11-06T00:00:00.000Z",
          "publishDown": null,
          "assignment": "all",
          "assignmentTokens": [],
          "note": ""
        }
      },
      {
        "key": "text-banner",
        "values": {
          "title": "Image",
          "extensionKey": "custom-html",
          "position": "banner",
          "ordering": 1,
          "settings": {
            "title": "",
            "html": "<img src=\"__SAMPLE_MEDIA_BASE__/images/banners/banner.jpg\" alt=\"\" loading=\"lazy\"><h1 class=\"display-4 text-thin\">Welcome to Joomla on Cassiopeia!</h1><p class=\"lead\"><strong>You have chosen one of the most powerful CMS Systems in the world.</strong></p><p class=\"lead\">Cassiopeia is the multi-purpose frontend template for Joomla.</p><p><a class=\"btn btn-primary btn-lg\" href=\"#/article/typography\">Typography »</a></p>"
          },
          "enabled": true,
          "showTitle": false,
          "scopeKind": "All",
          "scopeRoute": "",
          "scopeCategoryAlias": "",
          "trashed": false,
          "publishUp": "2026-11-06T00:00:00.000Z",
          "publishDown": null,
          "assignment": "only",
          "assignmentTokens": [
            "route:home"
          ],
          "note": ""
        }
      },
      {
        "key": "older-posts",
        "values": {
          "title": "Older Posts",
          "extensionKey": "articles",
          "position": "bottom-b",
          "ordering": 2,
          "settings": {
            "limit": 6,
            "category": "blog",
            "ordering": "oldest",
            "showDate": false
          },
          "enabled": true,
          "showTitle": true,
          "scopeKind": "All",
          "scopeRoute": "",
          "scopeCategoryAlias": "",
          "trashed": false,
          "publishUp": "2026-11-06T00:00:00.000Z",
          "publishDown": null,
          "assignment": "all",
          "assignmentTokens": [],
          "note": ""
        }
      }
    ],
    "siteConfig": [
      {
        "key": "site-configuration",
        "values": {
          "siteName": "Joomla Blog",
          "siteDescription": "Joomla Blog sample content — supported subset",
          "templateKey": "cassiopeia",
          "homeView": "category",
          "homeCategory": "blog",
          "language": "*",
          "timezone": "UTC",
          "basePath": "",
          "pageSize": 8,
          "customHtmlTitle": "",
          "customHtmlBody": "",
          "offline": false,
          "offlineMessage": "",
          "componentParamsJson": "{\"content\":{\"numLeading\":4,\"numIntro\":4,\"numColumns\":2,\"numLinks\":0,\"orderBy\":\"publishUp-desc\"}}",
          "templateStylesJson": "[{\"id\":\"cassiopeia-default\",\"template\":\"cassiopeia\",\"title\":\"Cassiopeia — Default\",\"home\":true,\"params\":{\"brand\":\"title\",\"logoFile\":\"\",\"siteTitle\":\"\",\"siteDescription\":\"\",\"colorName\":\"standard\",\"useFontScheme\":\"system\",\"fluidContainer\":false,\"stickyHeader\":false,\"backTop\":true}}]"
        }
      }
    ]
  },
  "assets": [
    {
      "path": "images/sampledata/cassiopeia/nasa1-1200.jpg",
      "bytes": 126175,
      "sha256": "ecafc122de573da79053ff6b7d94dafe040f6f48d330645030f31f816c81d07d"
    },
    {
      "path": "images/sampledata/cassiopeia/nasa1-400.jpg",
      "bytes": 23200,
      "sha256": "fba26fca347c4ca74965ec10582e7a38ad2b6b70321617455982813142dce20e"
    },
    {
      "path": "images/sampledata/cassiopeia/nasa2-1200.jpg",
      "bytes": 96137,
      "sha256": "a8ba177923e9cf26ae97f84db65fb43b9762ea7ed8d352bb4d4a0427d42f8de1"
    },
    {
      "path": "images/sampledata/cassiopeia/nasa2-400.jpg",
      "bytes": 26531,
      "sha256": "b10f85872899d851f719fefd8b9b2b4dbdde293cf019d1a367be2d640fdfef19"
    },
    {
      "path": "images/sampledata/cassiopeia/nasa3-1200.jpg",
      "bytes": 68445,
      "sha256": "2b7d3e462c35eff5db20613c8b8037f4f5f0184e4f27c949dec4407650e96a8a"
    },
    {
      "path": "images/sampledata/cassiopeia/nasa3-400.jpg",
      "bytes": 38085,
      "sha256": "f93cfa2cb21e7bf2a3625eb5909864af6eafaf33216a1e8a631a8c3775484b04"
    },
    {
      "path": "images/sampledata/cassiopeia/nasa4-1200.jpg",
      "bytes": 132261,
      "sha256": "cb0fc349634df70db2c8668d49667a462c11f3deeb39ed577334c77f4960811c"
    },
    {
      "path": "images/sampledata/cassiopeia/nasa4-400.jpg",
      "bytes": 6672,
      "sha256": "99c50a3fda52c4ededda1d8391abbd1e501e09fdfbd6e2ce8ff952a548847e6a"
    },
    {
      "path": "images/sampledata/cassiopeia/nasa1-640.jpg",
      "bytes": 26115,
      "sha256": "e8f792a737f6838debe35b3fbd83881b61ceb38b46264dcc9c7caae32e3dfaf9"
    },
    {
      "path": "images/sampledata/cassiopeia/nasa2-640.jpg",
      "bytes": 61706,
      "sha256": "339888de8b68e968846719b340f6a2e7cee29e3d87a22abbfaf1a381f396ac1b"
    },
    {
      "path": "images/sampledata/cassiopeia/nasa3-640.jpg",
      "bytes": 52154,
      "sha256": "9ecd22beaf9e6ce355daccd7a84ad9483bc19a3e9fcbbf079f611fd4f65c28f7"
    },
    {
      "path": "images/banners/banner.jpg",
      "bytes": 181597,
      "sha256": "62f1b7b507c8bac8980142c2fa8c07954f446b5ee9c876ba523f4b07e37ce9b4"
    }
  ]
};
